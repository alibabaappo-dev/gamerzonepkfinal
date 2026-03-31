import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldOff, ArrowLeft } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function Register() {
  // We keep the background and basic structure for visual consistency
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white flex flex-col font-sans relative overflow-hidden">
      {/* Background Image with Blur */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://i.ibb.co/N6t4r4zm/Whats-App-Image-2026-03-21-at-2-09-33-AM.jpg" 
          alt="Background" 
          className="w-full h-full object-cover opacity-90"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-[#0D0D0D]/80 to-[#0D0D0D]"></div>
      </div>

      <div className="flex-grow flex flex-col items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-[380px] bg-[#151B28]/90 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 shadow-2xl text-center">
          
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img src="https://i.ibb.co/JwjG5968/logo.png" alt="Gamer Zone Logo" className="w-23" />
          </div>

          {/* Icon for Closed Status */}
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-red-500/10 rounded-full">
              <ShieldOff size={48} className="text-red-500" />
            </div>
          </div>

          {/* Message */}
          <h1 className="text-2xl font-bold text-white mb-2 uppercase tracking-tight">
            Sign Up Closed
          </h1>
          <p className="text-gray-400 text-sm mb-8 leading-relaxed">
            Registration is currently disabled by the administrator. Please check back later or contact support.
          </p>

          {/* Return to Login Button */}
          <Link 
            to="/login" 
            className="w-full bg-[#1D4ED8] hover:bg-[#1E40AF] text-white font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            RETURN TO LOGIN
          </Link>

          <div className="mt-8 pt-6 border-t border-white/5">
            <p className="text-gray-500 text-[10px] uppercase tracking-widest">
              Gamer Zone Security System
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
