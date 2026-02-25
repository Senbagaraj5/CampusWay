import React, { useRef } from 'react';
import { Bus } from '../types';
import { ViewMode } from './StudentTrackingPage';

interface BottomSheetProps {
    bus: Bus;
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    eta: number | null;
    distance: string;
}

const BottomSheet: React.FC<BottomSheetProps> = ({ bus, viewMode, setViewMode, eta, distance }) => {
    const dragStartY = useRef<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        dragStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (dragStartY.current === null) return;
        const currentY = e.touches[0].clientY;
        const deltaY = dragStartY.current - currentY;

        // Swipe threshold
        if (Math.abs(deltaY) > 40) {
            if (deltaY > 0) { // Swiping up
                if (viewMode === 'COLLAPSED') setViewMode('MID');
                else if (viewMode === 'MID') setViewMode('EXPANDED');
            } else { // Swiping down
                if (viewMode === 'EXPANDED') setViewMode('MID');
                else if (viewMode === 'MID') setViewMode('COLLAPSED');
            }
            dragStartY.current = null;
        }
    };

    const getHeightClass = () => {
        switch (viewMode) {
            case 'COLLAPSED': return 'h-[80px]';
            case 'MID': return 'h-[320px]';
            case 'EXPANDED': return 'h-[85vh]';
            default: return 'h-[320px]';
        }
    };

    return (
        <div
            className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.06)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] z-[100] border-t border-slate-50 flex flex-col ${getHeightClass()} pb-safe`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
        >
            {/* Drag Handle Container (Full Width for easier drag) */}
            <div
                className="w-full flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing pointer-events-auto"
                onClick={() => {
                    if (viewMode === 'COLLAPSED') setViewMode('MID');
                    else if (viewMode === 'MID') setViewMode('EXPANDED');
                    else setViewMode('MID');
                }}
            >
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mb-4"></div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-5 overflow-x-hidden pt-0 pb-10">
                {/* 1. COLLAPSED VIEW / HEADER */}
                <div className="flex items-center justify-between min-h-[60px] mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-indigo-600 rounded-[1.25rem] flex items-center justify-center text-2xl shadow-xl shadow-indigo-100 ring-4 ring-indigo-50 transition-transform active:scale-90">
                            🚌
                        </div>
                        <div className="flex flex-col">
                            <h3 className="text-xl font-black text-slate-900 tracking-tighter leading-none mb-2">Bus {bus.busNumber}</h3>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                <span className="text-[10px] font-black text-green-600 uppercase tracking-[0.1em] leading-none">Live Now</span>
                            </div>
                        </div>
                    </div>

                    {viewMode === 'COLLAPSED' ? (
                        <div className="flex flex-col items-end bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">ETA</span>
                            <span className="text-base font-black text-indigo-600 font-mono">{eta ? `${eta}m` : '--'}</span>
                        </div>
                    ) : (
                        <button
                            onClick={() => setViewMode('COLLAPSED')}
                            className="w-10 h-10 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center active:scale-90 transition-all border border-slate-100"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                        </button>
                    )}
                </div>

                {/* 2. MID VIEW Content */}
                <div className={`transition-all duration-500 ${viewMode !== 'COLLAPSED' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none hidden'}`}>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 flex flex-col items-center justify-center shadow-sm">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Distance</p>
                            <p className="text-2xl font-black text-slate-900 tracking-tighter">{distance}</p>
                        </div>
                        <div className="bg-indigo-600 p-5 rounded-[2rem] shadow-xl shadow-indigo-100 flex flex-col items-center justify-center">
                            <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-2">Estimation</p>
                            <p className="text-2xl font-black text-white tracking-tighter">{eta ? `${eta} Min` : '---'}</p>
                        </div>
                    </div>

                    <div className="bg-white border-2 border-slate-50 rounded-[1.8rem] p-5 mb-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Route Information</span>
                        </div>
                        <p className="text-[13px] font-bold text-slate-700 leading-snug">{bus.route}</p>
                    </div>
                </div>

                {/* 3. EXPANDED VIEW Content */}
                <div className={`transition-all duration-500 ${viewMode === 'EXPANDED' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12 pointer-events-none hidden'}`}>
                    <div className="h-px bg-slate-100 w-full mb-8" />

                    <div className="flex flex-col gap-6">
                        <div>
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Assigned Driver</h4>
                            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-[1.8rem] border border-slate-100">
                                <div className="w-16 h-16 bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${bus.driverName || 'Felix'}`} alt="Driver" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-lg font-black text-slate-900 leading-none mb-1.5">{bus.driverName || 'Sivabalan'}</p>
                                    <p className="text-xs font-bold text-slate-500/70 uppercase tracking-tight">Verified Staff</p>
                                </div>
                                <a
                                    href={`tel:${bus.driverPhone || '1234567890'}`}
                                    className="w-12 h-12 bg-green-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-100 active:scale-90 transition-all"
                                >
                                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 005.405 5.405l.773-1.548a1 1 0 011.06-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 3z"></path></svg>
                                </a>
                            </div>
                        </div>

                        <div>
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Technical Status</h4>
                            <div className="grid grid-cols-1 gap-3">
                                <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-100">
                                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                                    <p className="text-sm font-bold text-slate-600">Engine Telemetry Active</p>
                                </div>
                                <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-100">
                                    <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                                    <p className="text-sm font-bold text-slate-600">GPS Sync: 3.2s latency</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


export default BottomSheet;
