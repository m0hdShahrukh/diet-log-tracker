import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft, Check, User, Scale, Activity, Target, Sparkles } from 'lucide-react';

const STEPS = [
  { icon: User, title: 'Personal Info', desc: 'Tell us about yourself' },
  { icon: Scale, title: 'Your Stats', desc: 'Current measurements' },
  { icon: Activity, title: 'Activity Level', desc: 'How active are you?' },
  { icon: Target, title: 'Your Goal', desc: 'Set your target' },
  { icon: Sparkles, title: 'Your Plan', desc: 'Review your personalized plan' },
];

const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary', desc: 'Little to no exercise' },
  { value: 'light', label: 'Lightly Active', desc: 'Light exercise 1-3 days/week' },
  { value: 'moderate', label: 'Moderately Active', desc: 'Moderate exercise 3-5 days/week' },
  { value: 'active', label: 'Very Active', desc: 'Hard exercise 6-7 days/week' },
  { value: 'very_active', label: 'Extremely Active', desc: 'Very hard exercise, physical job' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, updateUser, loadUser } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    age: '',
    gender: 'male',
    height_cm: '',
    current_weight: '',
    goal_weight: '',
    activity_level: 'moderate',
    weight_loss_rate: 1,
    units: 'imperial',
  });

  const [calculatedPlan, setCalculatedPlan] = useState(null);

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleNext = async () => {
    if (step === 0 && (!form.age || !form.gender)) {
      toast.error('Please fill in all fields');
      return;
    }
    if (step === 1 && (!form.height_cm || !form.current_weight || !form.goal_weight)) {
      toast.error('Please fill in all fields');
      return;
    }

    if (step === 3) {
      // Calculate plan
      setLoading(true);
      try {
        const heightCm = form.units === 'imperial'
          ? parseFloat(form.height_cm) * 2.54
          : parseFloat(form.height_cm);
        const weightKg = form.units === 'imperial'
          ? parseFloat(form.current_weight) * 0.453592
          : parseFloat(form.current_weight);
        const goalKg = form.units === 'imperial'
          ? parseFloat(form.goal_weight) * 0.453592
          : parseFloat(form.goal_weight);

        const res = await api.put('/profile', {
          age: parseInt(form.age),
          gender: form.gender,
          height_cm: Math.round(heightCm * 10) / 10,
          current_weight: Math.round(weightKg * 10) / 10,
          goal_weight: Math.round(goalKg * 10) / 10,
          activity_level: form.activity_level,
          weight_loss_rate: form.weight_loss_rate,
          units: form.units,
        });

        setCalculatedPlan(res.data);
        updateUser(res.data);
      } catch (err) {
        toast.error('Failed to calculate plan');
      } finally {
        setLoading(false);
      }
    }

    if (step < 4) setStep(step + 1);
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      await api.put('/profile', { onboarding_completed: true });
      await loadUser();
      toast.success('Welcome to DietLog!');
      navigate('/');
    } catch (err) {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const weightUnit = form.units === 'imperial' ? 'lbs' : 'kg';
  const heightUnit = form.units === 'imperial' ? 'inches' : 'cm';

  return (
    <div className="min-h-screen bg-[#FDFCF8] flex flex-col" data-testid="onboarding-page">
      {/* Progress */}
      <div className="px-6 pt-8 pb-4">
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                i < step ? 'bg-[#88C425] text-white' :
                i === step ? 'bg-slate-900 text-white' :
                'bg-slate-100 text-slate-400'
              }`}>
                {i < step ? <Check className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 mx-1 transition-colors ${i < step ? 'bg-[#88C425]' : 'bg-slate-200'}`} />
              )}
            </div>
          ))}
        </div>
        <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope' }}>
          {STEPS[step].title}
        </h2>
        <p className="text-slate-500 text-sm mt-1">{STEPS[step].desc}</p>
      </div>

      {/* Form Steps */}
      <div className="flex-1 px-6 py-6 animate-slide-up" key={step}>
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <Label className="text-slate-700 font-semibold text-sm mb-2 block">Units</Label>
              <Select value={form.units} onValueChange={(v) => updateField('units', v)}>
                <SelectTrigger data-testid="onboarding-units" className="h-12 rounded-xl bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="imperial">Imperial (lbs, inches)</SelectItem>
                  <SelectItem value="metric">Metric (kg, cm)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-700 font-semibold text-sm mb-2 block">Age</Label>
              <Input
                data-testid="onboarding-age"
                type="number"
                placeholder="Enter your age"
                value={form.age}
                onChange={(e) => updateField('age', e.target.value)}
                className="h-12 rounded-xl bg-white"
              />
            </div>
            <div>
              <Label className="text-slate-700 font-semibold text-sm mb-2 block">Gender</Label>
              <div className="grid grid-cols-2 gap-3">
                {['male', 'female'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    data-testid={`onboarding-gender-${g}`}
                    onClick={() => updateField('gender', g)}
                    className={`h-12 rounded-xl border-2 font-semibold text-sm capitalize transition-all ${
                      form.gender === g
                        ? 'border-[#88C425] bg-[#88C425]/10 text-[#76AD1B]'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div>
              <Label className="text-slate-700 font-semibold text-sm mb-2 block">Height ({heightUnit})</Label>
              <Input
                data-testid="onboarding-height"
                type="number"
                placeholder={form.units === 'imperial' ? 'e.g., 68 (5\'8")' : 'e.g., 172'}
                value={form.height_cm}
                onChange={(e) => updateField('height_cm', e.target.value)}
                className="h-12 rounded-xl bg-white"
              />
              {form.units === 'imperial' && <p className="text-xs text-slate-400 mt-1">Enter total inches (5'8" = 68 inches)</p>}
            </div>
            <div>
              <Label className="text-slate-700 font-semibold text-sm mb-2 block">Current Weight ({weightUnit})</Label>
              <Input
                data-testid="onboarding-current-weight"
                type="number"
                placeholder={`e.g., ${form.units === 'imperial' ? '180' : '82'}`}
                value={form.current_weight}
                onChange={(e) => updateField('current_weight', e.target.value)}
                className="h-12 rounded-xl bg-white"
              />
            </div>
            <div>
              <Label className="text-slate-700 font-semibold text-sm mb-2 block">Goal Weight ({weightUnit})</Label>
              <Input
                data-testid="onboarding-goal-weight"
                type="number"
                placeholder={`e.g., ${form.units === 'imperial' ? '160' : '72'}`}
                value={form.goal_weight}
                onChange={(e) => updateField('goal_weight', e.target.value)}
                className="h-12 rounded-xl bg-white"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            {ACTIVITY_LEVELS.map((a) => (
              <button
                key={a.value}
                type="button"
                data-testid={`onboarding-activity-${a.value}`}
                onClick={() => updateField('activity_level', a.value)}
                className={`w-full p-4 rounded-2xl text-left transition-all border-2 ${
                  form.activity_level === a.value
                    ? 'border-[#88C425] bg-[#88C425]/10'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className={`font-semibold text-sm ${form.activity_level === a.value ? 'text-[#76AD1B]' : 'text-slate-700'}`}>
                  {a.label}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">{a.desc}</div>
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <Label className="text-slate-700 font-semibold text-sm mb-3 block">
                Weight Loss Rate ({weightUnit}/week)
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {[0.5, 1, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    type="button"
                    data-testid={`onboarding-rate-${rate}`}
                    onClick={() => updateField('weight_loss_rate', rate)}
                    className={`h-14 rounded-2xl border-2 font-semibold text-sm transition-all ${
                      form.weight_loss_rate === rate
                        ? 'border-[#88C425] bg-[#88C425]/10 text-[#76AD1B]'
                        : 'border-slate-100 bg-white text-slate-600 hover:border-slate-200'
                    }`}
                  >
                    {rate} {weightUnit}/wk
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">
                {form.weight_loss_rate <= 1 ? 'Recommended for sustainable results' : 'Aggressive - consult a doctor'}
              </p>
            </div>
          </div>
        )}

        {step === 4 && calculatedPlan && (
          <div className="space-y-5 animate-slide-up">
            <div className="bg-white rounded-[2rem] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100/50">
              <div className="text-center mb-6">
                <div className="text-6xl font-extrabold text-slate-900" style={{ fontFamily: 'Manrope' }}>
                  {calculatedPlan.calorie_target}
                </div>
                <div className="text-slate-500 font-medium text-sm mt-1">calories per day</div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold" style={{ color: 'var(--color-protein)' }}>
                    {calculatedPlan.protein_target}g
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Protein</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold" style={{ color: 'var(--color-carbs)' }}>
                    {calculatedPlan.carbs_target}g
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Carbs</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold" style={{ color: 'var(--color-fat)' }}>
                    {calculatedPlan.fat_target}g
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">Fat</div>
                </div>
              </div>
            </div>

            {calculatedPlan.bmr && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl p-4 border border-slate-100/50">
                  <div className="text-sm text-slate-400">BMR</div>
                  <div className="text-lg font-bold text-slate-800">{calculatedPlan.bmr} cal</div>
                </div>
                <div className="bg-white rounded-2xl p-4 border border-slate-100/50">
                  <div className="text-sm text-slate-400">TDEE</div>
                  <div className="text-lg font-bold text-slate-800">{calculatedPlan.tdee} cal</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="px-6 pb-10 flex gap-3">
        {step > 0 && (
          <Button
            data-testid="onboarding-back"
            variant="outline"
            onClick={() => setStep(step - 1)}
            className="h-12 rounded-full px-6 border-slate-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <Button
          data-testid="onboarding-next"
          onClick={step === 4 ? handleFinish : handleNext}
          disabled={loading}
          className="flex-1 h-12 rounded-full bg-gradient-to-r from-[#88C425] to-[#76AD1B] text-white font-bold text-base shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
        >
          {loading ? 'Loading...' : step === 4 ? 'Start My Journey' : 'Continue'}
          {!loading && <ArrowRight className="w-5 h-5 ml-2" />}
        </Button>
      </div>
    </div>
  );
}
