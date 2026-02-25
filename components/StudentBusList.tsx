import React, { useMemo } from 'react';
import { Bus } from '../types';

interface StudentBusListProps {
    buses: Bus[];
    onSelectBus: (bus: Bus) => void;
}

const StudentBusCard: React.FC<{ bus: Bus; onClick: () => void }> = ({ bus, onClick }) => {
    const isLive = useMemo(() => {
        if (!bus.updatedAt || bus.status !== 'ACTIVE') return false;
        const now = Date.now();
        return (now - bus.updatedAt) <= 45000;
    }, [bus.updatedAt, bus.status]);

    return (
        <button
            onClick={onClick}
            className={`group relative flex flex-col p-4 bg-white rounded-2xl border-2 transition-all text-left shadow-sm active:scale-[0.97] w-full min-h-[160px] h-full overflow-hidden ${isLive ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-100'
                }`}
        >
            <div className="flex items-start justify-between mb-auto w-full">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isLive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-100 text-slate-400'
                    }`}>
                    <span className="text-xl font-black">{bus.busNumber}</span>
                </div>

                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border shrink-0 ${isLive ? 'bg-green-100 border-green-200' : 'bg-slate-50 border-slate-100'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-green-600 animate-pulse' : 'bg-slate-300'}`}></div>
                    <span className={`text-[8px] font-black uppercase tracking-wider ${isLive ? 'text-green-700' : 'text-slate-500'}`}>
                        {isLive ? 'LIVE' : bus.status}
                    </span>
                </div>
            </div>

            <div className="mt-4 w-full">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Route Unit</p>
                <h3 className="text-sm font-black text-slate-900 leading-tight truncate w-full">Bus {bus.busNumber}</h3>
                <p className="text-[10px] font-bold text-slate-500 mt-1 line-clamp-2 leading-snug opacity-80 h-7 overflow-hidden">
                    {bus.route}
                </p>
            </div>

            {isLive && (
                <div className="absolute top-2 right-2 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </div>
            )}
        </button>
    );
};

const StudentBusList: React.FC<StudentBusListProps> = ({ buses, onSelectBus }) => {
    const sortedBuses = useMemo(() => {
        return [...buses].sort((a, b) => parseInt(a.busNumber) - parseInt(b.busNumber));
    }, [buses]);

    return (
        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
            <div className="text-center px-4">
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Campus Fleet</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Active Units & Tracking</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-2">
                {sortedBuses.map((bus) => (
                    <StudentBusCard
                        key={bus.id}
                        bus={bus}
                        onClick={() => onSelectBus(bus)}
                    />
                ))}
            </div>

            {sortedBuses.length === 0 && (
                <div className="bg-white p-12 rounded-[2.5rem] text-center border border-slate-100 shadow-sm mx-2">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl animate-pulse">📡</div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Awaiting connection...</p>
                </div>
            )}
        </div>
    );
};

export default StudentBusList;
