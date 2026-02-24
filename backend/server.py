from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import PyMongoError
import certifi
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
mongo_client_options = {
    "serverSelectionTimeoutMS": int(os.environ.get("MONGO_SERVER_SELECTION_TIMEOUT_MS", "30000")),
}

if mongo_url.startswith("mongodb+srv://") or "tls=true" in mongo_url.lower():
    mongo_client_options["tlsCAFile"] = certifi.where()


def parse_cors_origins(raw_origins: str) -> list[str]:
    cleaned = raw_origins.strip()
    if cleaned in {"", "*"}:
        return ["*"]

    cleaned = cleaned.strip('[]')
    origins = [
        origin.strip().strip('"').strip("'").rstrip('/')
        for origin in cleaned.split(',')
        if origin.strip()
    ]
    return origins or ["*"]

client = AsyncIOMotorClient(mongo_url, **mongo_client_options)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'dietlog-secret-key-change-in-prod')
JWT_ALGORITHM = "HS256"
security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ===================== MODELS =====================

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    token: str
    user: dict

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    height_cm: Optional[float] = None
    current_weight: Optional[float] = None
    goal_weight: Optional[float] = None
    activity_level: Optional[str] = None
    weight_loss_rate: Optional[float] = None
    units: Optional[str] = None
    calorie_target: Optional[int] = None
    protein_target: Optional[int] = None
    carbs_target: Optional[int] = None
    fat_target: Optional[int] = None
    water_goal: Optional[int] = None
    onboarding_completed: Optional[bool] = None

class FoodLogCreate(BaseModel):
    food_name: str
    calories: float
    protein: float = 0
    carbs: float = 0
    fat: float = 0
    fiber: float = 0
    serving: str = ""
    quantity: float = 1
    meal_type: str = "snack"
    logged_at: Optional[str] = None

class WeightLogCreate(BaseModel):
    weight: float
    note: Optional[str] = ""
    logged_at: Optional[str] = None

class WaterLogAdd(BaseModel):
    amount_ml: int
    date: Optional[str] = None

class QuickFoodCreate(BaseModel):
    name: str
    calories: float
    protein: float = 0
    carbs: float = 0
    fat: float = 0
    fiber: float = 0
    serving: str = "1 serving"
    category: str = "custom"

# ===================== AUTH HELPERS =====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload["user_id"]
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ===================== AUTH ENDPOINTS =====================

@api_router.post("/auth/register")
async def register(req: RegisterRequest):
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "name": req.name,
        "email": req.email.lower(),
        "password": hash_password(req.password),
        "age": None,
        "gender": None,
        "height_cm": None,
        "current_weight": None,
        "goal_weight": None,
        "activity_level": "moderate",
        "weight_loss_rate": 1.0,
        "units": "imperial",
        "calorie_target": 2000,
        "protein_target": 150,
        "carbs_target": 200,
        "fat_target": 67,
        "water_goal": 2000,
        "onboarding_completed": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id)
    user_safe = {k: v for k, v in user_doc.items() if k not in ("password", "_id")}
    return {"token": token, "user": user_safe}

@api_router.post("/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(user["id"])
    user_safe = {k: v for k, v in user.items() if k not in ("password", "_id")}
    return {"token": token, "user": user_safe}

# ===================== PROFILE ENDPOINTS =====================

@api_router.get("/profile")
async def get_profile(user=Depends(get_current_user)):
    return user

@api_router.put("/profile")
async def update_profile(update: ProfileUpdate, user=Depends(get_current_user)):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    
    # Calculate BMR/TDEE/targets if we have enough data
    merged = {**user, **update_data}
    if all(merged.get(f) for f in ["age", "gender", "height_cm", "current_weight"]):
        bmr = calculate_bmr(merged["gender"], merged["current_weight"], merged["height_cm"], merged["age"])
        activity_multipliers = {
            "sedentary": 1.2, "light": 1.375, "moderate": 1.55,
            "active": 1.725, "very_active": 1.9
        }
        tdee = bmr * activity_multipliers.get(merged.get("activity_level", "moderate"), 1.55)
        weight_loss_rate = merged.get("weight_loss_rate", 1.0)
        deficit = weight_loss_rate * 500  # 500 cal deficit per lb/week
        calorie_target = max(1200, int(tdee - deficit))
        
        # Macro split: 40% carbs, 30% protein, 30% fat
        protein_target = int((calorie_target * 0.30) / 4)
        carbs_target = int((calorie_target * 0.40) / 4)
        fat_target = int((calorie_target * 0.30) / 9)
        
        update_data["calorie_target"] = calorie_target
        update_data["protein_target"] = protein_target
        update_data["carbs_target"] = carbs_target
        update_data["fat_target"] = fat_target
        update_data["bmr"] = int(bmr)
        update_data["tdee"] = int(tdee)
    
    await db.users.update_one({"id": user["id"]}, {"$set": update_data})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return updated

def calculate_bmr(gender: str, weight_kg: float, height_cm: float, age: int) -> float:
    """Mifflin-St Jeor equation"""
    if gender == "male":
        return 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    else:
        return 10 * weight_kg + 6.25 * height_cm - 5 * age - 161

# ===================== FOOD DATABASE =====================

@api_router.get("/foods")
async def search_foods(q: str = "", limit: int = 20, user=Depends(get_current_user)):
    if not q:
        foods = await db.food_items.find({}, {"_id": 0}).sort("popularity", -1).limit(limit).to_list(limit)
        return foods
    
    foods = await db.food_items.find(
        {"name": {"$regex": q, "$options": "i"}},
        {"_id": 0}
    ).sort("popularity", -1).limit(limit).to_list(limit)
    return foods

@api_router.post("/foods/custom")
async def create_custom_food(food: QuickFoodCreate, user=Depends(get_current_user)):
    food_doc = {
        "id": str(uuid.uuid4()),
        "name": food.name,
        "calories": food.calories,
        "protein": food.protein,
        "carbs": food.carbs,
        "fat": food.fat,
        "fiber": food.fiber,
        "serving": food.serving,
        "category": food.category,
        "source": "user",
        "created_by": user["id"],
        "popularity": 1,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.food_items.insert_one(food_doc)
    del food_doc["_id"]
    return food_doc

# ===================== FOOD LOGS =====================

@api_router.post("/food-logs")
async def create_food_log(entry: FoodLogCreate, user=Depends(get_current_user)):
    log_id = str(uuid.uuid4())
    logged_at = entry.logged_at or datetime.now(timezone.utc).isoformat()
    
    log_doc = {
        "id": log_id,
        "user_id": user["id"],
        "food_name": entry.food_name,
        "calories": round(entry.calories * entry.quantity, 1),
        "protein": round(entry.protein * entry.quantity, 1),
        "carbs": round(entry.carbs * entry.quantity, 1),
        "fat": round(entry.fat * entry.quantity, 1),
        "fiber": round(entry.fiber * entry.quantity, 1),
        "serving": entry.serving,
        "quantity": entry.quantity,
        "meal_type": entry.meal_type,
        "logged_at": logged_at,
        "date": logged_at[:10],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.food_logs.insert_one(log_doc)
    del log_doc["_id"]
    return log_doc

@api_router.get("/food-logs")
async def get_food_logs(date: str = None, user=Depends(get_current_user)):
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    logs = await db.food_logs.find(
        {"user_id": user["id"], "date": date},
        {"_id": 0}
    ).sort("logged_at", 1).to_list(100)
    return logs

@api_router.delete("/food-logs/{log_id}")
async def delete_food_log(log_id: str, user=Depends(get_current_user)):
    result = await db.food_logs.delete_one({"id": log_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Food log not found")
    return {"status": "deleted"}

@api_router.get("/food-logs/recent-foods")
async def get_recent_foods(user=Depends(get_current_user)):
    pipeline = [
        {"$match": {"user_id": user["id"]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$food_name",
            "food_name": {"$first": "$food_name"},
            "calories": {"$first": "$calories"},
            "protein": {"$first": "$protein"},
            "carbs": {"$first": "$carbs"},
            "fat": {"$first": "$fat"},
            "serving": {"$first": "$serving"},
            "quantity": {"$first": "$quantity"},
            "last_logged": {"$first": "$logged_at"}
        }},
        {"$sort": {"last_logged": -1}},
        {"$limit": 20},
        {"$project": {"_id": 0}}
    ]
    recent = await db.food_logs.aggregate(pipeline).to_list(20)
    return recent

# ===================== WEIGHT LOGS =====================

@api_router.post("/weight-logs")
async def create_weight_log(entry: WeightLogCreate, user=Depends(get_current_user)):
    log_id = str(uuid.uuid4())
    logged_at = entry.logged_at or datetime.now(timezone.utc).isoformat()
    
    log_doc = {
        "id": log_id,
        "user_id": user["id"],
        "weight": entry.weight,
        "note": entry.note or "",
        "logged_at": logged_at,
        "date": logged_at[:10],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.weight_logs.insert_one(log_doc)
    del log_doc["_id"]
    
    # Update current weight in profile
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"current_weight": entry.weight}}
    )
    
    return log_doc

@api_router.get("/weight-logs")
async def get_weight_logs(limit: int = 90, user=Depends(get_current_user)):
    logs = await db.weight_logs.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("logged_at", -1).limit(limit).to_list(limit)
    return logs

@api_router.delete("/weight-logs/{log_id}")
async def delete_weight_log(log_id: str, user=Depends(get_current_user)):
    result = await db.weight_logs.delete_one({"id": log_id, "user_id": user["id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Weight log not found")
    return {"status": "deleted"}

# ===================== WATER LOGS =====================

@api_router.post("/water-logs")
async def add_water(entry: WaterLogAdd, user=Depends(get_current_user)):
    date = entry.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    existing = await db.water_logs.find_one(
        {"user_id": user["id"], "date": date},
        {"_id": 0}
    )
    
    if existing:
        new_amount = existing["total_ml"] + entry.amount_ml
        new_entries = existing.get("entries", []) + [{"id": str(uuid.uuid4()), "amount_ml": entry.amount_ml, "time": datetime.now(timezone.utc).isoformat()}]
        await db.water_logs.update_one(
            {"user_id": user["id"], "date": date},
            {"$set": {"total_ml": new_amount, "entries": new_entries}}
        )
        return {"date": date, "total_ml": new_amount, "goal_ml": user.get("water_goal", 2000), "entries": new_entries}
    else:
        log_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "date": date,
            "total_ml": entry.amount_ml,
            "entries": [{"id": str(uuid.uuid4()), "amount_ml": entry.amount_ml, "time": datetime.now(timezone.utc).isoformat()}],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.water_logs.insert_one(log_doc)
        del log_doc["_id"]
        return {"date": date, "total_ml": entry.amount_ml, "goal_ml": user.get("water_goal", 2000), "entries": log_doc["entries"]}


@api_router.delete("/water-logs/last")
async def remove_last_water_entry(date: str = None, user=Depends(get_current_user)):
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    log = await db.water_logs.find_one(
        {"user_id": user["id"], "date": date},
        {"_id": 0}
    )

    if not log or not log.get("entries"):
        raise HTTPException(status_code=404, detail="No water entry found to remove")

    entries = log.get("entries", [])
    removed = entries[-1]
    remaining_entries = entries[:-1]
    amount_removed = int(removed.get("amount_ml", 0))
    new_total = max(0, int(log.get("total_ml", 0)) - amount_removed)

    await db.water_logs.update_one(
        {"user_id": user["id"], "date": date},
        {"$set": {"entries": remaining_entries, "total_ml": new_total}}
    )

    return {
        "date": date,
        "total_ml": new_total,
        "goal_ml": user.get("water_goal", 2000),
        "removed_entry": removed,
        "entries": remaining_entries
    }

@api_router.get("/water-logs")
async def get_water_log(date: str = None, user=Depends(get_current_user)):
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    log = await db.water_logs.find_one(
        {"user_id": user["id"], "date": date},
        {"_id": 0}
    )
    if not log:
        return {"date": date, "total_ml": 0, "goal_ml": user.get("water_goal", 2000), "entries": []}
    
    log["goal_ml"] = user.get("water_goal", 2000)
    return log

# ===================== DASHBOARD =====================

@api_router.get("/dashboard")
async def get_dashboard(date: str = None, user=Depends(get_current_user)):
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get food logs for the day
    food_logs = await db.food_logs.find(
        {"user_id": user["id"], "date": date},
        {"_id": 0}
    ).sort("logged_at", 1).to_list(100)
    
    # Aggregate macros
    total_calories = sum(f["calories"] for f in food_logs)
    total_protein = sum(f["protein"] for f in food_logs)
    total_carbs = sum(f["carbs"] for f in food_logs)
    total_fat = sum(f["fat"] for f in food_logs)
    
    # Get water log
    water_log = await db.water_logs.find_one(
        {"user_id": user["id"], "date": date},
        {"_id": 0}
    )
    water_total = water_log["total_ml"] if water_log else 0
    
    # Calculate streak
    streak = await calculate_streak(user["id"])
    
    return {
        "date": date,
        "calories": {"consumed": round(total_calories, 1), "target": user.get("calorie_target", 2000)},
        "protein": {"consumed": round(total_protein, 1), "target": user.get("protein_target", 150)},
        "carbs": {"consumed": round(total_carbs, 1), "target": user.get("carbs_target", 200)},
        "fat": {"consumed": round(total_fat, 1), "target": user.get("fat_target", 67)},
        "water": {"consumed_ml": water_total, "goal_ml": user.get("water_goal", 2000)},
        "food_logs": food_logs,
        "streak": streak,
        "meals": {
            "breakfast": [f for f in food_logs if f["meal_type"] == "breakfast"],
            "lunch": [f for f in food_logs if f["meal_type"] == "lunch"],
            "dinner": [f for f in food_logs if f["meal_type"] == "dinner"],
            "snack": [f for f in food_logs if f["meal_type"] == "snack"]
        }
    }

async def calculate_streak(user_id: str) -> int:
    streak = 0
    check_date = datetime.now(timezone.utc).date()
    
    for _ in range(365):
        date_str = check_date.strftime("%Y-%m-%d")
        count = await db.food_logs.count_documents({"user_id": user_id, "date": date_str})
        if count > 0:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break
    return streak

# ===================== WEEKLY STATS =====================

@api_router.get("/stats/weekly")
async def get_weekly_stats(user=Depends(get_current_user)):
    today = datetime.now(timezone.utc).date()
    week_start = today - timedelta(days=6)
    
    daily_stats = []
    total_cals = 0
    days_on_track = 0
    
    for i in range(7):
        d = week_start + timedelta(days=i)
        date_str = d.strftime("%Y-%m-%d")
        
        food_logs = await db.food_logs.find(
            {"user_id": user["id"], "date": date_str},
            {"_id": 0}
        ).to_list(100)
        
        day_cals = sum(f["calories"] for f in food_logs)
        total_cals += day_cals
        if day_cals > 0 and day_cals <= user.get("calorie_target", 2000):
            days_on_track += 1
        
        water = await db.water_logs.find_one(
            {"user_id": user["id"], "date": date_str},
            {"_id": 0}
        )
        
        daily_stats.append({
            "date": date_str,
            "day": d.strftime("%a"),
            "calories": round(day_cals, 1),
            "water_ml": water["total_ml"] if water else 0
        })
    
    avg_cals = round(total_cals / 7, 1)
    
    # Weight change this week
    weight_logs = await db.weight_logs.find(
        {"user_id": user["id"]},
        {"_id": 0}
    ).sort("logged_at", -1).limit(30).to_list(30)
    
    weight_change = 0
    if len(weight_logs) >= 2:
        weight_change = round(weight_logs[0]["weight"] - weight_logs[-1]["weight"], 1)
    
    return {
        "daily_stats": daily_stats,
        "avg_daily_calories": avg_cals,
        "days_on_track": days_on_track,
        "weight_change": weight_change,
        "total_calories": round(total_cals, 1)
    }

# ===================== FOOD DATABASE SEED =====================

SEED_FOODS = [
    {"name": "Scrambled Eggs", "calories": 140, "protein": 12, "carbs": 2, "fat": 10, "fiber": 0, "serving": "2 large eggs", "category": "protein"},
    {"name": "Oatmeal with Milk", "calories": 220, "protein": 9, "carbs": 38, "fat": 4, "fiber": 4, "serving": "1 cup cooked", "category": "grains"},
    {"name": "Grilled Chicken Breast", "calories": 165, "protein": 31, "carbs": 0, "fat": 3.6, "fiber": 0, "serving": "100g", "category": "protein"},
    {"name": "Brown Rice", "calories": 216, "protein": 5, "carbs": 45, "fat": 1.8, "fiber": 3.5, "serving": "1 cup cooked", "category": "grains"},
    {"name": "Broccoli (steamed)", "calories": 55, "protein": 4, "carbs": 11, "fat": 0.6, "fiber": 5.1, "serving": "1 cup", "category": "vegetables"},
    {"name": "Medium Apple", "calories": 95, "protein": 0.5, "carbs": 25, "fat": 0.3, "fiber": 4.4, "serving": "1 medium apple", "category": "fruits"},
    {"name": "Banana", "calories": 105, "protein": 1.3, "carbs": 27, "fat": 0.4, "fiber": 3.1, "serving": "1 medium", "category": "fruits"},
    {"name": "Greek Yogurt (plain)", "calories": 100, "protein": 17, "carbs": 6, "fat": 0.7, "fiber": 0, "serving": "170g", "category": "dairy"},
    {"name": "Whole Wheat Toast", "calories": 80, "protein": 4, "carbs": 15, "fat": 1, "fiber": 2, "serving": "1 slice", "category": "grains"},
    {"name": "Peanut Butter", "calories": 190, "protein": 7, "carbs": 7, "fat": 16, "fiber": 2, "serving": "2 tbsp", "category": "fats"},
    {"name": "Salmon Fillet", "calories": 208, "protein": 20, "carbs": 0, "fat": 13, "fiber": 0, "serving": "100g", "category": "protein"},
    {"name": "Sweet Potato", "calories": 103, "protein": 2.3, "carbs": 24, "fat": 0.1, "fiber": 3.8, "serving": "1 medium", "category": "vegetables"},
    {"name": "Avocado", "calories": 240, "protein": 3, "carbs": 12, "fat": 22, "fiber": 10, "serving": "1 whole", "category": "fats"},
    {"name": "Quinoa", "calories": 222, "protein": 8, "carbs": 39, "fat": 3.5, "fiber": 5, "serving": "1 cup cooked", "category": "grains"},
    {"name": "Mixed Salad (no dressing)", "calories": 20, "protein": 1.5, "carbs": 3.5, "fat": 0.2, "fiber": 2, "serving": "2 cups", "category": "vegetables"},
    {"name": "Chicken Thigh (skinless)", "calories": 209, "protein": 26, "carbs": 0, "fat": 11, "fiber": 0, "serving": "100g", "category": "protein"},
    {"name": "White Rice", "calories": 206, "protein": 4.3, "carbs": 45, "fat": 0.4, "fiber": 0.6, "serving": "1 cup cooked", "category": "grains"},
    {"name": "Egg (boiled)", "calories": 78, "protein": 6, "carbs": 0.6, "fat": 5, "fiber": 0, "serving": "1 large", "category": "protein"},
    {"name": "Turkey Breast", "calories": 135, "protein": 30, "carbs": 0, "fat": 1, "fiber": 0, "serving": "100g", "category": "protein"},
    {"name": "Cottage Cheese (low fat)", "calories": 163, "protein": 28, "carbs": 6, "fat": 2.3, "fiber": 0, "serving": "1 cup", "category": "dairy"},
    {"name": "Black Beans", "calories": 227, "protein": 15, "carbs": 41, "fat": 0.9, "fiber": 15, "serving": "1 cup cooked", "category": "protein"},
    {"name": "Almonds", "calories": 164, "protein": 6, "carbs": 6, "fat": 14, "fiber": 3.5, "serving": "1 oz (23 almonds)", "category": "fats"},
    {"name": "Orange", "calories": 62, "protein": 1.2, "carbs": 15, "fat": 0.2, "fiber": 3.1, "serving": "1 medium", "category": "fruits"},
    {"name": "Whole Milk", "calories": 149, "protein": 8, "carbs": 12, "fat": 8, "fiber": 0, "serving": "1 cup", "category": "dairy"},
    {"name": "Skim Milk", "calories": 83, "protein": 8, "carbs": 12, "fat": 0.2, "fiber": 0, "serving": "1 cup", "category": "dairy"},
    {"name": "Cheddar Cheese", "calories": 113, "protein": 7, "carbs": 0.4, "fat": 9, "fiber": 0, "serving": "1 oz", "category": "dairy"},
    {"name": "Tuna (canned in water)", "calories": 116, "protein": 26, "carbs": 0, "fat": 0.8, "fiber": 0, "serving": "100g", "category": "protein"},
    {"name": "Spinach (raw)", "calories": 7, "protein": 0.9, "carbs": 1.1, "fat": 0.1, "fiber": 0.7, "serving": "1 cup", "category": "vegetables"},
    {"name": "Olive Oil", "calories": 119, "protein": 0, "carbs": 0, "fat": 14, "fiber": 0, "serving": "1 tbsp", "category": "fats"},
    {"name": "Pasta (cooked)", "calories": 220, "protein": 8, "carbs": 43, "fat": 1.3, "fiber": 2.5, "serving": "1 cup", "category": "grains"},
    {"name": "Steak (sirloin)", "calories": 207, "protein": 26, "carbs": 0, "fat": 11, "fiber": 0, "serving": "100g", "category": "protein"},
    {"name": "Ground Beef (lean)", "calories": 250, "protein": 26, "carbs": 0, "fat": 15, "fiber": 0, "serving": "100g", "category": "protein"},
    {"name": "Blueberries", "calories": 85, "protein": 1.1, "carbs": 21, "fat": 0.5, "fiber": 3.6, "serving": "1 cup", "category": "fruits"},
    {"name": "Strawberries", "calories": 49, "protein": 1, "carbs": 12, "fat": 0.5, "fiber": 3, "serving": "1 cup", "category": "fruits"},
    {"name": "Protein Shake", "calories": 120, "protein": 24, "carbs": 3, "fat": 1.5, "fiber": 0, "serving": "1 scoop + water", "category": "protein"},
    {"name": "Granola Bar", "calories": 190, "protein": 4, "carbs": 29, "fat": 7, "fiber": 2, "serving": "1 bar", "category": "snacks"},
    {"name": "Rice Cake", "calories": 35, "protein": 0.7, "carbs": 7.3, "fat": 0.3, "fiber": 0.4, "serving": "1 cake", "category": "snacks"},
    {"name": "Carrots", "calories": 52, "protein": 1.2, "carbs": 12, "fat": 0.3, "fiber": 3.6, "serving": "1 cup", "category": "vegetables"},
    {"name": "Cucumber", "calories": 16, "protein": 0.7, "carbs": 3.6, "fat": 0.1, "fiber": 0.5, "serving": "1 cup", "category": "vegetables"},
    {"name": "Tomato", "calories": 22, "protein": 1.1, "carbs": 4.8, "fat": 0.2, "fiber": 1.5, "serving": "1 medium", "category": "vegetables"},
    {"name": "Bell Pepper", "calories": 31, "protein": 1, "carbs": 6, "fat": 0.3, "fiber": 2.1, "serving": "1 medium", "category": "vegetables"},
    {"name": "Mushrooms", "calories": 15, "protein": 2.2, "carbs": 2.3, "fat": 0.2, "fiber": 0.7, "serving": "1 cup", "category": "vegetables"},
    {"name": "Corn on the Cob", "calories": 88, "protein": 3.3, "carbs": 19, "fat": 1.4, "fiber": 2, "serving": "1 medium ear", "category": "vegetables"},
    {"name": "Hummus", "calories": 166, "protein": 8, "carbs": 14, "fat": 10, "fiber": 4, "serving": "1/3 cup", "category": "snacks"},
    {"name": "Dark Chocolate", "calories": 170, "protein": 2, "carbs": 13, "fat": 12, "fiber": 3, "serving": "1 oz", "category": "snacks"},
    {"name": "Popcorn (air-popped)", "calories": 31, "protein": 1, "carbs": 6, "fat": 0.4, "fiber": 1.2, "serving": "1 cup", "category": "snacks"},
    {"name": "Shrimp", "calories": 84, "protein": 18, "carbs": 0, "fat": 1, "fiber": 0, "serving": "100g", "category": "protein"},
    {"name": "Tofu", "calories": 144, "protein": 15, "carbs": 3.5, "fat": 8, "fiber": 2, "serving": "1/2 cup", "category": "protein"},
    {"name": "Lentils", "calories": 230, "protein": 18, "carbs": 40, "fat": 0.8, "fiber": 16, "serving": "1 cup cooked", "category": "protein"},
    {"name": "Chickpeas", "calories": 269, "protein": 14.5, "carbs": 45, "fat": 4.2, "fiber": 12.5, "serving": "1 cup cooked", "category": "protein"},
    {"name": "Walnuts", "calories": 185, "protein": 4.3, "carbs": 3.9, "fat": 18.5, "fiber": 1.9, "serving": "1 oz", "category": "fats"},
    {"name": "Honey", "calories": 64, "protein": 0.1, "carbs": 17, "fat": 0, "fiber": 0, "serving": "1 tbsp", "category": "other"},
    {"name": "Coffee (black)", "calories": 2, "protein": 0.3, "carbs": 0, "fat": 0, "fiber": 0, "serving": "8 oz", "category": "beverages"},
    {"name": "Green Tea", "calories": 2, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0, "serving": "8 oz", "category": "beverages"},
    {"name": "Orange Juice", "calories": 112, "protein": 1.7, "carbs": 26, "fat": 0.5, "fiber": 0.5, "serving": "8 oz", "category": "beverages"},
    {"name": "Protein Bar", "calories": 210, "protein": 20, "carbs": 22, "fat": 7, "fiber": 3, "serving": "1 bar", "category": "snacks"},
    {"name": "Bagel (plain)", "calories": 270, "protein": 10, "carbs": 53, "fat": 1.5, "fiber": 2, "serving": "1 bagel", "category": "grains"},
    {"name": "Cream Cheese", "calories": 51, "protein": 1, "carbs": 0.8, "fat": 5, "fiber": 0, "serving": "1 tbsp", "category": "dairy"},
    {"name": "Mozzarella Cheese", "calories": 85, "protein": 6, "carbs": 0.7, "fat": 6, "fiber": 0, "serving": "1 oz", "category": "dairy"},
    {"name": "Pancakes", "calories": 227, "protein": 6, "carbs": 28, "fat": 10, "fiber": 1, "serving": "2 medium", "category": "grains"},
    {"name": "French Fries", "calories": 365, "protein": 4, "carbs": 48, "fat": 17, "fiber": 4, "serving": "medium serving", "category": "snacks"},
    {"name": "Pizza Slice (cheese)", "calories": 285, "protein": 12, "carbs": 36, "fat": 10, "fiber": 2.5, "serving": "1 large slice", "category": "other"},
    {"name": "Hamburger (with bun)", "calories": 354, "protein": 20, "carbs": 29, "fat": 17, "fiber": 1.3, "serving": "1 burger", "category": "other"},
    {"name": "Caesar Salad", "calories": 180, "protein": 7, "carbs": 8, "fat": 14, "fiber": 2, "serving": "1.5 cups", "category": "vegetables"},
    {"name": "Grilled Vegetables", "calories": 70, "protein": 2, "carbs": 12, "fat": 2, "fiber": 3, "serving": "1 cup", "category": "vegetables"},
    {"name": "Sushi Roll (California)", "calories": 255, "protein": 9, "carbs": 38, "fat": 7, "fiber": 2, "serving": "6 pieces", "category": "other"},
    {"name": "Smoothie Bowl", "calories": 300, "protein": 8, "carbs": 55, "fat": 7, "fiber": 6, "serving": "1 bowl", "category": "other"},
    {"name": "Trail Mix", "calories": 175, "protein": 5, "carbs": 15, "fat": 11, "fiber": 2, "serving": "1/4 cup", "category": "snacks"},
    {"name": "Coconut Water", "calories": 46, "protein": 1.7, "carbs": 9, "fat": 0.5, "fiber": 2.6, "serving": "8 oz", "category": "beverages"},
    {"name": "Edamame", "calories": 188, "protein": 18, "carbs": 14, "fat": 8, "fiber": 8, "serving": "1 cup", "category": "protein"},
    {"name": "String Cheese", "calories": 80, "protein": 7, "carbs": 1, "fat": 5, "fiber": 0, "serving": "1 stick", "category": "dairy"},
    {"name": "Tortilla Wrap", "calories": 120, "protein": 3, "carbs": 20, "fat": 3, "fiber": 1, "serving": "1 wrap", "category": "grains"},
    {"name": "Chicken Soup", "calories": 75, "protein": 5, "carbs": 9, "fat": 2, "fiber": 1, "serving": "1 cup", "category": "other"},
    {"name": "Mango", "calories": 99, "protein": 1.4, "carbs": 25, "fat": 0.6, "fiber": 2.6, "serving": "1 cup sliced", "category": "fruits"},
    {"name": "Grapes", "calories": 104, "protein": 1.1, "carbs": 27, "fat": 0.2, "fiber": 1.4, "serving": "1 cup", "category": "fruits"},
    {"name": "Watermelon", "calories": 46, "protein": 0.9, "carbs": 11.5, "fat": 0.2, "fiber": 0.6, "serving": "1 cup", "category": "fruits"},
    {"name": "Chia Seeds", "calories": 138, "protein": 4.7, "carbs": 12, "fat": 8.7, "fiber": 9.8, "serving": "1 oz", "category": "other"},
    {"name": "Flaxseed", "calories": 55, "protein": 1.9, "carbs": 3, "fat": 4.3, "fiber": 2.8, "serving": "1 tbsp", "category": "other"},
]

async def seed_food_database():
    count = await db.food_items.count_documents({})
    if count == 0:
        logger.info("Seeding food database...")
        for i, food in enumerate(SEED_FOODS):
            food_doc = {
                "id": str(uuid.uuid4()),
                "name": food["name"],
                "calories": food["calories"],
                "protein": food["protein"],
                "carbs": food["carbs"],
                "fat": food["fat"],
                "fiber": food.get("fiber", 0),
                "serving": food["serving"],
                "category": food["category"],
                "source": "seed",
                "popularity": 100 - i,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.food_items.insert_one(food_doc)
        logger.info(f"Seeded {len(SEED_FOODS)} foods")
        
        # Create indexes
        await db.food_items.create_index("name")
        await db.food_logs.create_index([("user_id", 1), ("date", 1)])
        await db.weight_logs.create_index([("user_id", 1), ("logged_at", -1)])
        await db.water_logs.create_index([("user_id", 1), ("date", 1)])
        await db.users.create_index("email", unique=True)

@app.exception_handler(PyMongoError)
async def mongodb_exception_handler(request, exc):
    logger.exception("MongoDB operation failed: %s", exc)
    return JSONResponse(status_code=503, content={"detail": "Database temporarily unavailable"})


@app.on_event("startup")
async def startup_event():
    try:
        await client.admin.command("ping")
        await seed_food_database()
    except Exception as exc:
        logger.exception("MongoDB unavailable during startup: %s", exc)

# ===================== APP SETUP =====================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=parse_cors_origins(os.environ.get('CORS_ORIGINS', '*')),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
