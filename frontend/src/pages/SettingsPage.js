import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { User, Target, Ruler, LogOut, Save, ChevronRight } from 'lucide-react';

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const [loading, setLoading] = useState(false);

  const [profile, setProfile] = useState({
    name: user?.name || '',
    age: user?.age || '',
    gender: user?.gender || 'male',
    units: user?.units || 'imperial',
  });

  const [goals, setGoals] = useState({
    calorie_target: user?.calorie_target || 2000,
    protein_target: user?.protein_target || 150,
    carbs_target: user?.carbs_target || 200,
    fat_target: user?.fat_target || 67,
    water_goal: user?.water_goal || 2000,
    goal_weight: user?.goal_weight || '',
  });

  const saveProfile = async () => {
    setLoading(true);
    try {
      const res = await api.put('/profile', {
        name: profile.name,
        age: parseInt(profile.age),
        gender: profile.gender,
        units: profile.units,
      });
      updateUser(res.data);
      toast.success('Profile updated');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const saveGoals = async () => {
    setLoading(true);
    try {
      const res = await api.put('/profile', {
        calorie_target: parseInt(goals.calorie_target),
        protein_target: parseInt(goals.protein_target),
        carbs_target: parseInt(goals.carbs_target),
        fat_target: parseInt(goals.fat_target),
        water_goal: parseInt(goals.water_goal),
        goal_weight: parseFloat(goals.goal_weight) || undefined,
      });
      updateUser(res.data);
      toast.success('Goals updated');
    } catch {
      toast.error('Failed to update goals');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out');
  };

  const weightUnit = profile.units === 'imperial' ? 'lbs' : 'kg';

  return (
    <div className="page-container bg-[#FDFCF8]" data-testid="settings-page">
      <div className="px-6 pt-8 pb-4">
        <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>Settings</h1>
      </div>

      {/* Profile Section */}
      <div className="px-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Profile</h2>
        </div>
        <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100/50 space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-500">Name</Label>
            <Input
              data-testid="settings-name"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="h-11 rounded-xl mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-500">Age</Label>
              <Input
                data-testid="settings-age"
                type="number"
                value={profile.age}
                onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                className="h-11 rounded-xl mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-500">Gender</Label>
              <Select value={profile.gender} onValueChange={(v) => setProfile({ ...profile, gender: v })}>
                <SelectTrigger data-testid="settings-gender" className="h-11 rounded-xl mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-500">Units</Label>
            <Select value={profile.units} onValueChange={(v) => setProfile({ ...profile, units: v })}>
              <SelectTrigger data-testid="settings-units" className="h-11 rounded-xl mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="imperial">Imperial (lbs, inches)</SelectItem>
                <SelectItem value="metric">Metric (kg, cm)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            data-testid="save-profile"
            onClick={saveProfile}
            disabled={loading}
            className="w-full h-11 rounded-full bg-slate-900 text-white font-semibold hover:bg-slate-800"
          >
            <Save className="w-4 h-4 mr-2" /> Save Profile
          </Button>
        </div>
      </div>

      {/* Goals Section */}
      <div className="px-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Daily Goals</h2>
        </div>
        <div className="bg-white rounded-[2rem] p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100/50 space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-500">Calorie Target</Label>
            <Input
              data-testid="settings-calories"
              type="number"
              value={goals.calorie_target}
              onChange={(e) => setGoals({ ...goals, calorie_target: e.target.value })}
              className="h-11 rounded-xl mt-1"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold" style={{ color: 'var(--color-protein)' }}>Protein (g)</Label>
              <Input
                data-testid="settings-protein"
                type="number"
                value={goals.protein_target}
                onChange={(e) => setGoals({ ...goals, protein_target: e.target.value })}
                className="h-11 rounded-xl mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold" style={{ color: 'var(--color-carbs)' }}>Carbs (g)</Label>
              <Input
                data-testid="settings-carbs"
                type="number"
                value={goals.carbs_target}
                onChange={(e) => setGoals({ ...goals, carbs_target: e.target.value })}
                className="h-11 rounded-xl mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold" style={{ color: 'var(--color-fat)' }}>Fat (g)</Label>
              <Input
                data-testid="settings-fat"
                type="number"
                value={goals.fat_target}
                onChange={(e) => setGoals({ ...goals, fat_target: e.target.value })}
                className="h-11 rounded-xl mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold text-slate-500">Water Goal (ml)</Label>
              <Input
                data-testid="settings-water"
                type="number"
                value={goals.water_goal}
                onChange={(e) => setGoals({ ...goals, water_goal: e.target.value })}
                className="h-11 rounded-xl mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-500">Goal Weight ({weightUnit})</Label>
              <Input
                data-testid="settings-goal-weight"
                type="number"
                value={goals.goal_weight}
                onChange={(e) => setGoals({ ...goals, goal_weight: e.target.value })}
                className="h-11 rounded-xl mt-1"
              />
            </div>
          </div>
          <Button
            data-testid="save-goals"
            onClick={saveGoals}
            disabled={loading}
            className="w-full h-11 rounded-full bg-slate-900 text-white font-semibold hover:bg-slate-800"
          >
            <Save className="w-4 h-4 mr-2" /> Save Goals
          </Button>
        </div>
      </div>

      {/* Account */}
      <div className="px-6 mb-8">
        <Separator className="mb-4" />
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">{user?.email}</span>
          <Button
            data-testid="logout-btn"
            variant="ghost"
            onClick={handleLogout}
            className="text-red-500 hover:text-red-600 hover:bg-red-50 font-semibold rounded-full"
          >
            <LogOut className="w-4 h-4 mr-2" /> Logout
          </Button>
        </div>
      </div>
    </div>
  );
}
