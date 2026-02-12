import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import CalorieRing from '@/components/CalorieRing';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Droplets, Flame, Plus, ChevronLeft, ChevronRight,
  Coffee, Sun, Moon, Cookie, Trash2
} from 'lucide-react';

const MEAL_ICONS = {
  breakfast: Coffee,
  lunch: Sun,
  dinner: Moon,
  snack: Cookie,
};

const MEAL_LABELS = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

const WATER_AMOUNTS = [
  { label: '200ml', value: 200 },
  { label: '250ml', value: 250 },
  { label: '500ml', value: 500 },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get(`/dashboard?date=${date}`);
      setDashboard(res.data);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const addWater = async (amount) => {
    try {
      await api.post('/water-logs', { amount_ml: amount, date });
      fetchDashboard();
      toast.success(`+${amount}ml water logged`);
    } catch {
      toast.error('Failed to log water');
    }
  };

  const deleteFoodLog = async (logId) => {
    try {
      await api.delete(`/food-logs/${logId}`);
      fetchDashboard();
      toast.success('Entry removed');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const changeDate = (delta) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(format(d, 'yyyy-MM-dd'));
    setLoading(true);
  };

  const isToday = date === format(new Date(), 'yyyy-MM-dd');

  if (loading || !dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFCF8]">
        <div className="w-10 h-10 border-4 border-[#88C425] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const waterPercent = Math.min((dashboard.water.consumed_ml / dashboard.water.goal_ml) * 100, 100);
  const waterGlasses = Math.floor(dashboard.water.consumed_ml / 250);

  return (
    <div className="page-container bg-[#FDFCF8]" data-testid="dashboard-page">
      {/* Header */}
      <div className="px-6 pt-8 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
              Hey, {user?.name?.split(' ')[0] || 'there'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-semibold text-orange-500">{dashboard.streak} day streak</span>
            </div>
          </div>
        </div>
        {/* Date Nav */}
        <div className="flex items-center justify-center gap-4 mt-4">
          <button onClick={() => changeDate(-1)} className="p-2 rounded-full hover:bg-slate-100 transition-colors" data-testid="date-prev">
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </button>
          <span className="text-sm font-semibold text-slate-700 min-w-[140px] text-center">
            {isToday ? 'Today' : format(new Date(date + 'T12:00:00'), 'EEE, MMM d')}
          </span>
          <button onClick={() => changeDate(1)} className="p-2 rounded-full hover:bg-slate-100 transition-colors" data-testid="date-next"
            disabled={isToday}>
            <ChevronRight className={`w-5 h-5 ${isToday ? 'text-slate-200' : 'text-slate-500'}`} />
          </button>
        </div>
      </div>

      {/* Calorie Ring - Hero */}
      <div className="flex justify-center py-4">
        <CalorieRing consumed={dashboard.calories.consumed} target={dashboard.calories.target} size={200} />
      </div>
      <div className="text-center mb-6">
        <span className="text-sm text-slate-500">
          <span className="font-bold text-slate-700">{Math.round(dashboard.calories.consumed)}</span>
          {' / '}
          {dashboard.calories.target} cal
        </span>
      </div>

      {/* Macro Bars */}
      <div className="px-6 mb-6">
        <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100/50" data-testid="macro-tracker">
          <MacroBar label="Protein" consumed={dashboard.protein.consumed} target={dashboard.protein.target} color="var(--color-protein)" unit="g" />
          <MacroBar label="Carbs" consumed={dashboard.carbs.consumed} target={dashboard.carbs.target} color="var(--color-carbs)" unit="g" />
          <MacroBar label="Fat" consumed={dashboard.fat.consumed} target={dashboard.fat.target} color="var(--color-fat)" unit="g" />
        </div>
      </div>

      {/* Water Tracker */}
      <div className="px-6 mb-6">
        <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100/50" data-testid="water-tracker">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Droplets className="w-5 h-5" style={{ color: 'var(--color-water)' }} />
              <span className="font-bold text-sm text-slate-700">Water</span>
            </div>
            <span className="text-xs font-semibold text-slate-400">
              {dashboard.water.consumed_ml}ml / {dashboard.water.goal_ml}ml
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-sky-100 mb-3">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${waterPercent}%`, backgroundColor: 'var(--color-water)' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-auto">
              {Array.from({ length: 8 }).map((_, i) => (
                <Droplets key={i} className={`w-4 h-4 ${i < waterGlasses ? 'text-sky-500' : 'text-slate-200'}`} />
              ))}
            </div>
            {WATER_AMOUNTS.map((w) => (
              <button
                key={w.value}
                data-testid={`water-add-${w.value}`}
                onClick={() => addWater(w.value)}
                className="px-3 py-1.5 text-xs font-semibold rounded-full bg-sky-50 text-sky-600 hover:bg-sky-100 transition-colors"
              >
                +{w.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Add Meal Buttons */}
      <div className="px-6 mb-4">
        <div className="flex gap-2">
          {['breakfast', 'lunch', 'dinner', 'snack'].map((meal) => {
            const Icon = MEAL_ICONS[meal];
            const count = dashboard.meals[meal]?.length || 0;
            return (
              <a
                key={meal}
                href={`/add-food/${meal}`}
                data-testid={`quick-add-${meal}`}
                className="flex-1 bg-white rounded-2xl p-3 text-center border border-slate-100/50 hover:border-[#88C425]/30 transition-all shadow-sm"
              >
                <Icon className="w-5 h-5 mx-auto mb-1 text-slate-500" />
                <div className="text-xs font-semibold text-slate-600 capitalize">{meal}</div>
                {count > 0 && <div className="text-[10px] text-slate-400 mt-0.5">{count} items</div>}
              </a>
            );
          })}
        </div>
      </div>

      {/* Meal Timeline */}
      <div className="px-6 mb-6">
        <h3 className="text-sm font-bold text-slate-800 mb-3" style={{ fontFamily: 'Manrope' }}>
          Today's Meals
        </h3>
        {dashboard.food_logs.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100/50">
            <p className="text-slate-400 text-sm">No meals logged yet</p>
            <a href="/add-food">
              <Button className="mt-3 rounded-full bg-gradient-to-r from-[#88C425] to-[#76AD1B] text-white text-xs h-9 px-5" data-testid="log-first-meal">
                <Plus className="w-4 h-4 mr-1" /> Log your first meal
              </Button>
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {dashboard.food_logs.map((log) => {
              const Icon = MEAL_ICONS[log.meal_type] || Cookie;
              return (
                <div
                  key={log.id}
                  className="bg-white rounded-2xl p-4 flex items-center gap-3 border border-transparent hover:border-slate-100 transition-colors"
                  data-testid={`food-log-${log.id}`}
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-slate-700 truncate">{log.food_name}</div>
                    <div className="text-xs text-slate-400">{log.serving} &middot; {MEAL_LABELS[log.meal_type]}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-sm text-slate-800">{Math.round(log.calories)}</div>
                    <div className="text-[10px] text-slate-400">cal</div>
                  </div>
                  <button
                    onClick={() => deleteFoodLog(log.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors ml-1"
                    data-testid={`delete-food-${log.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MacroBar({ label, consumed, target, color, unit }) {
  const percent = Math.min((consumed / target) * 100, 100);
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <span className="text-xs font-semibold text-slate-700">
          {Math.round(consumed)}{unit} / {target}{unit}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
