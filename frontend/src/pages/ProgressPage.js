import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { TrendingDown, TrendingUp, Plus, Scale, CalendarDays, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Area, AreaChart } from 'recharts';

export default function ProgressPage() {
  const { user } = useAuth();
  const [weightLogs, setWeightLogs] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [newWeight, setNewWeight] = useState('');
  const [weightNote, setWeightNote] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [wRes, sRes] = await Promise.all([
        api.get('/weight-logs?limit=90'),
        api.get('/stats/weekly'),
      ]);
      setWeightLogs(wRes.data);
      setWeeklyStats(sRes.data);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addWeight = async () => {
    if (!newWeight) { toast.error('Enter your weight'); return; }
    try {
      await api.post('/weight-logs', {
        weight: parseFloat(newWeight),
        note: weightNote,
        logged_at: new Date().toISOString(),
      });
      toast.success('Weight logged!');
      setShowAddWeight(false);
      setNewWeight('');
      setWeightNote('');
      fetchData();
    } catch {
      toast.error('Failed to log weight');
    }
  };

  const deleteWeight = async (id) => {
    try {
      await api.delete(`/weight-logs/${id}`);
      toast.success('Entry removed');
      fetchData();
    } catch {
      toast.error('Failed to delete');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFCF8]">
        <div className="w-10 h-10 border-4 border-[#88C425] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const chartData = [...weightLogs].reverse().map((l) => ({
    date: format(new Date(l.logged_at), 'MMM d'),
    weight: l.weight,
  }));

  const calorieChartData = weeklyStats?.daily_stats || [];

  const startWeight = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1].weight : user?.current_weight || 0;
  const currentWeight = weightLogs.length > 0 ? weightLogs[0].weight : user?.current_weight || 0;
  const totalChange = Math.round((currentWeight - startWeight) * 10) / 10;
  const toGoal = user?.goal_weight ? Math.round((currentWeight - user.goal_weight) * 10) / 10 : 0;
  const weightUnit = user?.units === 'imperial' ? 'lbs' : 'kg';

  return (
    <div className="page-container bg-[#FDFCF8]" data-testid="progress-page">
      <div className="px-6 pt-8 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>Progress</h1>
          <Button
            data-testid="add-weight-btn"
            onClick={() => setShowAddWeight(true)}
            className="h-10 rounded-full bg-gradient-to-r from-[#88C425] to-[#76AD1B] text-white text-sm font-bold px-5"
          >
            <Scale className="w-4 h-4 mr-1.5" /> Log Weight
          </Button>
        </div>
      </div>

      <Tabs defaultValue="weight" className="px-6">
        <TabsList className="w-full bg-slate-100 rounded-2xl h-11 p-1 mb-5">
          <TabsTrigger value="weight" data-testid="tab-weight" className="flex-1 rounded-xl text-sm font-semibold">Weight</TabsTrigger>
          <TabsTrigger value="calories" data-testid="tab-calories" className="flex-1 rounded-xl text-sm font-semibold">Calories</TabsTrigger>
          <TabsTrigger value="summary" data-testid="tab-summary" className="flex-1 rounded-xl text-sm font-semibold">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="weight" className="animate-slide-up">
          {/* Weight Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <StatCard label="Current" value={`${currentWeight}`} unit={weightUnit} />
            <StatCard label="Change" value={`${totalChange >= 0 ? '+' : ''}${totalChange}`} unit={weightUnit}
              icon={totalChange <= 0 ? TrendingDown : TrendingUp}
              iconColor={totalChange <= 0 ? '#10B981' : '#ef4444'} />
            <StatCard label="Start" value={`${startWeight}`} unit={weightUnit} />
            <StatCard label="To Goal" value={`${toGoal}`} unit={`${weightUnit} left`} />
          </div>

          {/* Weight Chart */}
          {chartData.length > 1 ? (
            <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100/50 mb-5" data-testid="weight-chart">
              <h3 className="text-sm font-bold text-slate-700 mb-4">Weight Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#88C425" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#88C425" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis domain={['dataMin - 2', 'dataMax + 2']} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                  <Area type="monotone" dataKey="weight" stroke="#88C425" strokeWidth={2.5} fill="url(#weightGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 text-center mb-5">
              <p className="text-slate-400 text-sm">Log at least 2 weights to see your trend chart</p>
            </div>
          )}

          {/* Weight History */}
          <h3 className="text-sm font-bold text-slate-700 mb-3">History</h3>
          <div className="space-y-2 mb-6">
            {weightLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="bg-white rounded-2xl p-4 flex items-center gap-3" data-testid={`weight-log-${log.id}`}>
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                  <Scale className="w-5 h-5 text-slate-400" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-slate-800">{log.weight} {weightUnit}</div>
                  <div className="text-xs text-slate-400">{format(new Date(log.logged_at), 'MMM d, yyyy')}</div>
                </div>
                {log.note && <span className="text-xs text-slate-400 max-w-[100px] truncate">{log.note}</span>}
                <button onClick={() => deleteWeight(log.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                  data-testid={`delete-weight-${log.id}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="calories" className="animate-slide-up">
          {weeklyStats && (
            <>
              <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100/50 mb-5" data-testid="calorie-chart">
                <h3 className="text-sm font-bold text-slate-700 mb-4">This Week's Calories</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={calorieChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }} />
                    <Bar dataKey="calories" fill="#88C425" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Avg Daily" value={`${Math.round(weeklyStats.avg_daily_calories)}`} unit="cal" />
                <StatCard label="Days on Track" value={`${weeklyStats.days_on_track}`} unit="/ 7" />
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="summary" className="animate-slide-up">
          {weeklyStats && (
            <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100/50" data-testid="weekly-summary">
              <h3 className="text-lg font-bold text-slate-900 mb-4" style={{ fontFamily: 'Manrope' }}>This Week</h3>
              <div className="space-y-4">
                <SummaryRow
                  icon={<Scale className="w-5 h-5" />}
                  label="Weight Change"
                  value={`${weeklyStats.weight_change >= 0 ? '+' : ''}${weeklyStats.weight_change} ${weightUnit}`}
                  positive={weeklyStats.weight_change <= 0}
                />
                <SummaryRow
                  icon={<CalendarDays className="w-5 h-5" />}
                  label="Days on Track"
                  value={`${weeklyStats.days_on_track} / 7`}
                  positive={weeklyStats.days_on_track >= 5}
                />
                <SummaryRow
                  icon={<TrendingDown className="w-5 h-5" />}
                  label="Avg Daily Calories"
                  value={`${Math.round(weeklyStats.avg_daily_calories)} cal`}
                  positive={weeklyStats.avg_daily_calories <= (user?.calorie_target || 2000)}
                />
                <SummaryRow
                  icon={<TrendingUp className="w-5 h-5" />}
                  label="Total Calories"
                  value={`${Math.round(weeklyStats.total_calories)} cal`}
                />
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Weight Dialog */}
      <Dialog open={showAddWeight} onOpenChange={setShowAddWeight}>
        <DialogContent className="rounded-3xl max-w-sm mx-auto" data-testid="add-weight-dialog">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Log Weight</DialogTitle>
            <DialogDescription>Enter today's weight</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs font-semibold text-slate-500">Weight ({weightUnit})</Label>
              <Input
                data-testid="weight-input"
                type="number"
                step="0.1"
                placeholder={`e.g., ${currentWeight || 150}`}
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className="h-12 rounded-xl mt-1 text-lg font-bold text-center"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-500">Note (optional)</Label>
              <Input
                data-testid="weight-note"
                placeholder="e.g., After morning workout"
                value={weightNote}
                onChange={(e) => setWeightNote(e.target.value)}
                className="h-10 rounded-xl mt-1"
              />
            </div>
            <Button
              data-testid="weight-submit"
              onClick={addWeight}
              className="w-full h-12 rounded-full bg-gradient-to-r from-[#88C425] to-[#76AD1B] text-white font-bold"
            >
              Save Weight
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, unit, icon: Icon, iconColor }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100/50">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className="w-4 h-4" style={{ color: iconColor }} />}
        <span className="text-xs font-semibold text-slate-400">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-slate-800">{value}</span>
        <span className="text-xs text-slate-400">{unit}</span>
      </div>
    </div>
  );
}

function SummaryRow({ icon, label, value, positive }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${positive === undefined ? 'bg-slate-100 text-slate-500' : positive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
        {icon}
      </div>
      <span className="flex-1 text-sm text-slate-600">{label}</span>
      <span className={`text-sm font-bold ${positive === undefined ? 'text-slate-700' : positive ? 'text-green-600' : 'text-red-500'}`}>
        {value}
      </span>
    </div>
  );
}
