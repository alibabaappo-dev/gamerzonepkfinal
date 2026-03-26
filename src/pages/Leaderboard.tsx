import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy, Medal, CheckCircle2, Award, Star, Check } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, doc, query, orderBy, limit } from 'firebase/firestore';

export default function Leaderboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [leaderboardConfig, setLeaderboardConfig] = useState({
    dailyRewards: 'Top 3 get 50 coins!',
    weeklyChampion: 'Winner gets 500 Diamonds',
    allTimeChampion: 'Hall of Fame'
  });

  useEffect(() => {
    // OPTIMIZATION: Fetch ONLY Top 20 users to save Firestore Reads
    const q = query(
      collection(db, 'users'), 
      orderBy('totalWins', 'desc'), 
      limit(20) 
    );

    const unsubUsers = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map((doc, index) => ({
        rank: index + 1,
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersData);
    });

    const unsubConfig = onSnapshot(doc(db, 'settings', 'leaderboard'), (docSnap) => {
      if (docSnap.exists()) {
        setLeaderboardConfig(docSnap.data() as any);
      }
    });

    return () => {
      unsubUsers();
      unsubConfig();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#050B14] text-white p-4 font-sans">
      <div className="max-w-md mx-auto">
        <Link to="/" className="inline-flex items-center text-gray-400 mb-6 hover:text-white transition-colors">
          <ArrowLeft size={20} className="mr-2" />
          <span className="font-medium">Back to Dashboard</span>
        </Link>

        {/* Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="flex items-center justify-center mb-2">
            <Trophy size={32} className="text-yellow-400 mr-3" />
            <h1 className="text-3xl font-bold text-white">Leaderboard</h1>
          </div>
          <p className="text-gray-400 text-sm">Top 20 Players of Gamer Zone</p>
        </div>

        <div className="space-y-6">
          {/* Leaderboard Notice Card */}
          <div className="bg-gradient-to-br from-[#1e1b2e] to-[#0F0A16] border border-purple-500/20 rounded-2xl p-6 shadow-lg relative overflow-hidden mb-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
            <h3 className="text-purple-400 font-bold text-lg mb-4">Leaderboard Notice</h3>
            <div className="space-y-4">
              {leaderboardConfig.allTimeChampion.split('\n').map((line, idx) => (
                <div key={idx} className="flex items-start">
                  <Trophy size={18} className="text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-purple-200 text-sm font-medium">{line}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center mb-2">
            <Trophy size={24} className="text-yellow-400 mr-3" />
            <h2 className="text-xl font-bold text-white">Top 20 Champions</h2>
          </div>

          {/* Player List */}
          <div className="space-y-3 pb-10">
            {users.map((player) => (
              <div 
                key={player.id} 
                className={`rounded-2xl p-4 flex items-center justify-between border transition-all ${
                  player.rank === 1 ? 'bg-[#1A1500] border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.1)]' :
                  player.rank === 2 ? 'bg-[#0F1521] border-gray-400/30' :
                  player.rank === 3 ? 'bg-[#1A0F0A] border-orange-500/30' :
                  'bg-[#0B101A] border-gray-800/50'
                }`}
              >
                <div className="flex items-center overflow-hidden">
                  <div className="w-8 flex justify-center mr-4 flex-shrink-0">
                    {player.rank === 1 ? (
                      <Trophy size={24} className="text-yellow-400" />
                    ) : player.rank === 2 ? (
                      <Medal size={24} className="text-gray-300" />
                    ) : player.rank === 3 ? (
                      <Medal size={24} className="text-orange-400" />
                    ) : (
                      <span className="text-gray-500 font-bold text-sm">#{player.rank}</span>
                    )}
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center">
                      <span className={`font-black text-sm truncate mr-2 ${
                        player.rank === 1 ? 'text-yellow-400' : 
                        player.rank === 2 ? 'text-gray-300' : 
                        player.rank === 3 ? 'text-orange-400' : 'text-white'
                      }`}>
                        {player.username || 'Anonymous'}
                      </span>
                      {player.rank <= 3 && (
                        <div className="flex items-center bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={10} className="text-green-500 mr-1" />
                          <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">Verified</span>
                        </div>
                      )}
                    </div>
                    {/* OPTIMIZATION: Email hidden for security/privacy */}
                    <div className="text-gray-500 text-[10px] font-bold uppercase tracking-tighter mt-0.5">
                      Gamer Zone Player
                    </div>
                  </div>
                </div>
                
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="text-xl font-black text-white leading-none">{player.totalWins || 0}</div>
                  <div className="text-gray-500 text-[9px] font-black uppercase tracking-widest mt-1">
                    Wins
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
