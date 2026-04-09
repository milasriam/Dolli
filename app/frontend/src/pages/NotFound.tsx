import { Link } from 'react-router-dom';
import { Heart, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 shadow-2xl shadow-violet-500/30 mb-6">
          <Heart className="w-10 h-10 text-white fill-white" />
        </div>
        <h1 className="text-5xl font-black mb-4">404</h1>
        <p className="text-xl text-slate-400 mb-8">This page doesn't exist yet, but your impact does.</p>
        <Link to="/">
          <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-bold px-8 py-6 rounded-2xl shadow-2xl shadow-violet-500/25 border-0">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}