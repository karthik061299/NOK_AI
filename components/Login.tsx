import React, { useState } from 'react';
import { dbService } from '../services/db';
import bcrypt from 'bcryptjs';
import { Cpu, LogIn, UserPlus, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validatePassword = (pw: string) => {
    const errors = [];
    if (pw.length < 8) errors.push("be at least 8 characters long");
    if (!/[A-Z]/.test(pw)) errors.push("contain an uppercase letter");
    if (!/[a-z]/.test(pw)) errors.push("contain a lowercase letter");
    if (!/\d/.test(pw)) errors.push("contain a number");
    if (!/[^A-Za-z0-9]/.test(pw)) errors.push("contain a special character");
    return errors;
  };

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (isLoginView) {
      try {
        const user = await dbService.getUserByEmail(email);
        if (!user || !user.password_hash) {
          throw new Error("Invalid email or password.");
        }
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
          throw new Error("Invalid email or password.");
        }
        onLogin({ id: user.id, email: user.email, role: user.role });
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    } else { // Sign Up
      const passwordErrors = validatePassword(password);
      if (passwordErrors.length > 0) {
        setError(`Password must: ${passwordErrors.join(', ')}.`);
        setIsLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        setIsLoading(false);
        return;
      }
      try {
        const existingUser = await dbService.getUserByEmail(email);
        if (existingUser) {
          throw new Error("An account with this email already exists.");
        }
        
        const allUsers = await dbService.getAllUsers();
        const role = allUsers.length === 0 ? 'Owner' : 'User';
        
        const hashedPassword = await bcrypt.hash(password, 10);
        await dbService.createUser(crypto.randomUUID(), email, hashedPassword, role);
        
        alert(role === 'Owner' 
          ? 'Account created successfully! As the first user, you have been assigned the Owner role.'
          : 'Account created successfully! Please sign in.');
          
        setIsLoginView(true);
        setPassword('');
        setConfirmPassword('');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-zinc-100 dark:bg-[#0c0c0e] p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
            <div className="mb-6">
                <img src="/NOK_Light_LOGO.png" alt="NOK AI Logo" className="h-12 dark:hidden" />
                <img src="/NOK_Dark_LOGO.png" alt="NOK AI Logo" className="h-12 hidden dark:block" />
            </div>
            <p className="text-zinc-500">Sign in to orchestrate your AI workflows.</p>
        </div>
        
        <div className="bg-white dark:bg-[#121214] border border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl shadow-2xl">
          <form onSubmit={handleAuthAction} className="space-y-6">
            <h2 className="text-xl font-semibold text-center text-zinc-800 dark:text-zinc-200">{isLoginView ? 'Welcome Back' : 'Create Account'}</h2>
            
            {error && (
              <div className="bg-red-100/50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20 p-3 rounded-lg text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-2 w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none text-zinc-900 dark:text-zinc-100" />
            </div>
            <div className="relative">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Password</label>
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-2 w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none text-zinc-900 dark:text-zinc-100" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-[37px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {!isLoginView && (
              <div className="relative">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Confirm Password</label>
                <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="mt-2 w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none text-zinc-900 dark:text-zinc-100" />
                 <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-[37px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}
            
            <button type="submit" disabled={isLoading} className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : (isLoginView ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />)}
              {isLoading ? 'Processing...' : (isLoginView ? 'Sign In' : 'Sign Up')}
            </button>
          </form>
          
          <p className="text-center text-xs text-zinc-500 mt-6">
            {isLoginView ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => { setIsLoginView(!isLoginView); setError(''); }} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              {isLoginView ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};