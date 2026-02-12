import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, ArrowLeft, Plus, Minus, Clock, Star } from 'lucide-react';

export default function AddFoodPage() {
  const navigate = useNavigate();
  const { mealType } = useParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [recentFoods, setRecentFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [meal, setMeal] = useState(mealType || 'snack');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickFood, setQuickFood] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });

  useEffect(() => {
    loadRecentFoods();
  }, []);

  const loadRecentFoods = async () => {
    try {
      const res = await api.get('/food-logs/recent-foods');
      setRecentFoods(res.data);
    } catch {}
  };

  const searchFoods = useCallback(async (q) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/foods?q=${encodeURIComponent(q)}&limit=20`);
      setResults(res.data);
    } catch {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchFoods(query), 300);
    return () => clearTimeout(timer);
  }, [query, searchFoods]);

  const addFood = async (food, qty, mealType) => {
    try {
      await api.post('/food-logs', {
        food_name: food.name || food.food_name,
        calories: food.calories,
        protein: food.protein || 0,
        carbs: food.carbs || 0,
        fat: food.fat || 0,
        fiber: food.fiber || 0,
        serving: food.serving || '1 serving',
        quantity: qty,
        meal_type: mealType,
        logged_at: new Date().toISOString(),
      });
      toast.success(`${food.name || food.food_name} added!`);
      setSelectedFood(null);
      setQuantity(1);
      navigate('/');
    } catch {
      toast.error('Failed to add food');
    }
  };

  const handleQuickAdd = async () => {
    if (!quickFood.name || !quickFood.calories) {
      toast.error('Name and calories are required');
      return;
    }
    await addFood({
      name: quickFood.name,
      calories: parseFloat(quickFood.calories),
      protein: parseFloat(quickFood.protein) || 0,
      carbs: parseFloat(quickFood.carbs) || 0,
      fat: parseFloat(quickFood.fat) || 0,
      serving: '1 serving',
    }, 1, meal);
    setShowQuickAdd(false);
    setQuickFood({ name: '', calories: '', protein: '', carbs: '', fat: '' });
  };

  const displayFoods = query.trim() ? results : recentFoods;
  const sectionTitle = query.trim() ? 'Search Results' : 'Recent Foods';

  return (
    <div className="page-container bg-[#FDFCF8]" data-testid="add-food-page">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate('/')} className="p-2 rounded-full hover:bg-slate-100 transition-colors" data-testid="add-food-back">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>Add Food</h1>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <Input
            data-testid="food-search"
            placeholder="Search foods..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 rounded-2xl bg-slate-50 border-none pl-12 text-slate-700 placeholder:text-slate-400 font-medium"
          />
        </div>

        {/* Meal Selector + Quick Add */}
        <div className="flex items-center gap-2 mt-3">
          <Select value={meal} onValueChange={setMeal}>
            <SelectTrigger data-testid="meal-type-select" className="h-10 rounded-xl bg-white text-sm flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="breakfast">Breakfast</SelectItem>
              <SelectItem value="lunch">Lunch</SelectItem>
              <SelectItem value="dinner">Dinner</SelectItem>
              <SelectItem value="snack">Snack</SelectItem>
            </SelectContent>
          </Select>
          <Button
            data-testid="quick-add-btn"
            onClick={() => setShowQuickAdd(true)}
            variant="outline"
            className="h-10 rounded-xl text-sm font-semibold border-dashed border-slate-300"
          >
            <Plus className="w-4 h-4 mr-1" /> Quick Add
          </Button>
        </div>
      </div>

      {/* Results */}
      <div className="px-6">
        <div className="flex items-center gap-2 mb-3">
          {query.trim() ? <Search className="w-4 h-4 text-slate-400" /> : <Clock className="w-4 h-4 text-slate-400" />}
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{sectionTitle}</span>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <div className="w-8 h-8 border-3 border-[#88C425] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : displayFoods.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-slate-400 text-sm">
              {query.trim() ? 'No foods found' : 'No recent foods yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayFoods.map((food, idx) => (
              <button
                key={food.id || food.food_name || idx}
                data-testid={`food-item-${idx}`}
                onClick={() => { setSelectedFood(food); setQuantity(1); }}
                className="w-full bg-white rounded-2xl p-4 flex items-center gap-3 text-left hover:shadow-sm transition-all border border-transparent hover:border-slate-100"
              >
                <div className="w-11 h-11 rounded-xl bg-[#88C425]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">
                    {food.category === 'protein' ? '🥩' :
                     food.category === 'vegetables' ? '🥦' :
                     food.category === 'fruits' ? '🍎' :
                     food.category === 'grains' ? '🌾' :
                     food.category === 'dairy' ? '🥛' :
                     food.category === 'fats' ? '🥑' :
                     food.category === 'beverages' ? '☕' :
                     food.category === 'snacks' ? '🍿' : '🍽️'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-slate-700 truncate">
                    {food.name || food.food_name}
                  </div>
                  <div className="text-xs text-slate-400">{food.serving}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-sm text-slate-800">{Math.round(food.calories)}</div>
                  <div className="text-[10px] text-slate-400">cal</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Food Detail Dialog */}
      <Dialog open={!!selectedFood} onOpenChange={() => setSelectedFood(null)}>
        <DialogContent className="rounded-3xl max-w-sm mx-auto" data-testid="food-detail-dialog">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {selectedFood?.name || selectedFood?.food_name}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              {selectedFood?.serving}
            </DialogDescription>
          </DialogHeader>
          
          {selectedFood && (
            <div className="space-y-4">
              {/* Quantity */}
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-slate-600">Quantity</Label>
                <div className="flex items-center gap-3">
                  <button
                    data-testid="qty-minus"
                    onClick={() => setQuantity(Math.max(0.5, quantity - 0.5))}
                    className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-lg font-bold text-slate-800 min-w-[3ch] text-center">{quantity}</span>
                  <button
                    data-testid="qty-plus"
                    onClick={() => setQuantity(quantity + 0.5)}
                    className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Nutrition */}
              <div className="grid grid-cols-4 gap-3">
                <NutritionPill label="Cal" value={Math.round(selectedFood.calories * quantity)} color="#1E293B" />
                <NutritionPill label="Pro" value={`${Math.round((selectedFood.protein || 0) * quantity)}g`} color="var(--color-protein)" />
                <NutritionPill label="Carb" value={`${Math.round((selectedFood.carbs || 0) * quantity)}g`} color="var(--color-carbs)" />
                <NutritionPill label="Fat" value={`${Math.round((selectedFood.fat || 0) * quantity)}g`} color="var(--color-fat)" />
              </div>

              <Button
                data-testid="add-food-confirm"
                onClick={() => addFood(selectedFood, quantity, meal)}
                className="w-full h-12 rounded-full bg-gradient-to-r from-[#88C425] to-[#76AD1B] text-white font-bold shadow-lg"
              >
                Add to {meal.charAt(0).toUpperCase() + meal.slice(1)}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Add Dialog */}
      <Dialog open={showQuickAdd} onOpenChange={setShowQuickAdd}>
        <DialogContent className="rounded-3xl max-w-sm mx-auto" data-testid="quick-add-dialog">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">Quick Add</DialogTitle>
            <DialogDescription className="text-sm text-slate-500">Manually enter food details</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold text-slate-500">Food Name</Label>
              <Input
                data-testid="quick-food-name"
                placeholder="e.g., Homemade Salad"
                value={quickFood.name}
                onChange={(e) => setQuickFood({ ...quickFood, name: e.target.value })}
                className="h-10 rounded-xl mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-500">Calories</Label>
                <Input
                  data-testid="quick-food-calories"
                  type="number"
                  placeholder="0"
                  value={quickFood.calories}
                  onChange={(e) => setQuickFood({ ...quickFood, calories: e.target.value })}
                  className="h-10 rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-500">Protein (g)</Label>
                <Input
                  data-testid="quick-food-protein"
                  type="number"
                  placeholder="0"
                  value={quickFood.protein}
                  onChange={(e) => setQuickFood({ ...quickFood, protein: e.target.value })}
                  className="h-10 rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-500">Carbs (g)</Label>
                <Input
                  data-testid="quick-food-carbs"
                  type="number"
                  placeholder="0"
                  value={quickFood.carbs}
                  onChange={(e) => setQuickFood({ ...quickFood, carbs: e.target.value })}
                  className="h-10 rounded-xl mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-500">Fat (g)</Label>
                <Input
                  data-testid="quick-food-fat"
                  type="number"
                  placeholder="0"
                  value={quickFood.fat}
                  onChange={(e) => setQuickFood({ ...quickFood, fat: e.target.value })}
                  className="h-10 rounded-xl mt-1"
                />
              </div>
            </div>
            <Button
              data-testid="quick-add-confirm"
              onClick={handleQuickAdd}
              className="w-full h-11 rounded-full bg-gradient-to-r from-[#88C425] to-[#76AD1B] text-white font-bold"
            >
              Add to Log
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NutritionPill({ label, value, color }) {
  return (
    <div className="text-center p-2 bg-slate-50 rounded-xl">
      <div className="text-xs text-slate-400 mb-0.5">{label}</div>
      <div className="text-sm font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
