import React, { useState, useEffect, useRef } from 'react';
import { Bus, Location } from '../types';
import MapComponent from './MapComponent';
import { Capacitor } from '@capacitor/core';
import { googleMapsService } from '../services/googleMapsService';

interface StudentTrackingPageProps {
    selectedBus: Bus;
    studentLocation: Location | null;
    onBack: () => void;
    eta: number | null;
    isActive: boolean;
}

export type ViewMode = 'COLLAPSED' | 'HALF' | 'FULL' | 'HIDDEN';

const StudentTrackingPage: React.FC<StudentTrackingPageProps> = ({
    selectedBus,
    studentLocation,
    onBack,
    eta,
    isActive
}) => {
    const [viewMode, setViewMode] = useState<ViewMode>('COLLAPSED');
    const [distanceText, setDistanceText] = useState<string>('--');
    const [etaDisplay, setEtaDisplay] = useState<string>('--');

    // Drag state
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef<number | null>(null);
    const currentY = useRef<number | null>(null);
    const [dragOffset, setDragOffset] = useState<number>(0);

    const handleRouteUpdate = (data: { distance: number | null; duration: number | null }) => {
        if (!isActive || data.distance === null || selectedBus.status !== 'online') {
            setDistanceText('--');
            setEtaDisplay('--');
            return;
        }

        setDistanceText(googleMapsService.formatDistance(data.distance * 1000));
        setEtaDisplay(googleMapsService.formatETA(data.duration));
    };

    useEffect(() => {
        if (!isActive) {
            setDistanceText('--');
            setEtaDisplay('--');
        }
    }, [isActive]);

    // Fix 3 — Close map function
    const closeMap = () => {
        onBack();
        if (window.location.hash === '#map') {
            window.history.back();
        }
    };

    // Hardware Back Button (Capacitor)
    useEffect(() => {
        let backListener: any;
        if (Capacitor.isNativePlatform()) {
            import('@capacitor/app').then(({ App }) => {
                backListener = App.addListener('backButton', () => {
                    closeMap();
                });
            });
        }
        return () => {
            if (backListener) backListener.then((l: any) => l.remove());
        };
    }, []);

    // Fix 3 — Back button handling (Web/PopState)
    useEffect(() => {
        window.history.pushState({ page: 'map' }, '', '#map');
        const handlePopState = () => closeMap();
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // Drag Handlers
    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
        setIsDragging(true);
        if ('touches' in e) {
            startY.current = e.touches[0].clientY;
            currentY.current = e.touches[0].clientY;
        } else {
            startY.current = (e as React.MouseEvent).clientY;
            currentY.current = (e as React.MouseEvent).clientY;
        }
    };

    const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isDragging || startY.current === null) return;
        let targetY = ('touches' in e) ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        currentY.current = targetY;
        setDragOffset(targetY - startY.current);
    };

    const handleTouchEnd = () => {
        if (!isDragging) return;
        setIsDragging(false);
        setDragOffset(0);
        if (startY.current !== null && currentY.current !== null) {
            const dragDistance = currentY.current - startY.current;
            const threshold = 50;
            if (dragDistance < -threshold) {
                if (viewMode === 'HIDDEN') setViewMode('COLLAPSED');
                else if (viewMode === 'COLLAPSED') setViewMode('HALF');
                else if (viewMode === 'HALF') setViewMode('FULL');
            } else if (dragDistance > threshold) {
                if (viewMode === 'FULL') setViewMode('HALF');
                else if (viewMode === 'HALF') setViewMode('COLLAPSED');
                else if (viewMode === 'COLLAPSED') setViewMode('HIDDEN');
            }
        }
        startY.current = null;
        currentY.current = null;
    };

    const getSheetStyle = (): React.CSSProperties => {
        let baseHeight = '120px';
        let bottomOffset = '0px';
        switch (viewMode) {
            case 'COLLAPSED': baseHeight = '120px'; bottomOffset = '0px'; break;
            case 'HALF': baseHeight = '45vh'; bottomOffset = '0px'; break;
            case 'FULL': baseHeight = '85vh'; bottomOffset = '0px'; break;
            case 'HIDDEN': baseHeight = '120px'; bottomOffset = '-120px'; break;
        }
        const transform = isDragging ? `translateY(${Math.max(dragOffset, -100)}px)` : 'translateY(0)';
        return {
            height: baseHeight,
            bottom: bottomOffset,
            transform,
            transition: isDragging ? 'none' : 'height 0.3s ease, bottom 0.3s ease, transform 0.3s ease',
            position: 'fixed',
            left: 0,
            right: 0,
            background: 'white',
            borderRadius: '20px 20px 0 0',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
            zIndex: 1000,
            touchAction: 'none'
        };
    };

    return (
        <div className="fixed inset-0 bg-white z-[60] flex flex-col overflow-hidden select-none animate-in fade-in duration-500">
            <div className="absolute inset-0 z-0">
                <MapComponent
                    busId={selectedBus.id}
                    busNumber={selectedBus.busNumber}
                    viewMode={viewMode}
                    onRouteUpdate={handleRouteUpdate}
                />
            </div>

            <div className="absolute top-[calc(env(safe-area-inset-top)+16px)] left-0 right-0 px-4 z-[110] flex items-center justify-between pointer-events-none">
                <button
                    onClick={(e) => { e.stopPropagation(); closeMap(); }}
                    className="w-11 h-11 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl border border-slate-50 text-slate-900 active:scale-95 transition-all flex items-center justify-center pointer-events-auto"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center gap-3 border border-white/10 pointer-events-none">
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.8)]"></div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.12em] leading-none">Bus {selectedBus.busNumber}</span>
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Live Tracking</span>
                    </div>
                </div>
            </div>

            <div 
                style={getSheetStyle()}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleTouchStart}
                onMouseMove={handleTouchMove}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                className="flex flex-col p-4 pointer-events-auto"
            >
                <div className="w-full flex justify-center mb-4 cursor-grab active:cursor-grabbing">
                    <div className="w-10 h-1 bg-slate-300 rounded-full"></div>
                </div>

                <div className="flex items-center justify-between mb-4 px-2">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-[1.25rem] flex items-center justify-center text-xl shadow-lg ring-4 ring-indigo-50">
                            🚌
                        </div>
                        <div className="flex flex-col">
                            <h3 className="text-xl font-black text-slate-900 tracking-tighter leading-none mb-1">Bus {selectedBus.busNumber}</h3>
                            <div className="flex items-center gap-2">
                                {selectedBus.status === 'online' ? (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-green-200 bg-green-50">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                        <span className="text-[9px] font-black text-green-700 uppercase tracking-widest leading-none">Live</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50">
                                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full"></div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Offline</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {viewMode !== 'COLLAPSED' && viewMode !== 'HIDDEN' && (
                    <div className="grid grid-cols-2 gap-3 mt-2 px-2 animate-in fade-in duration-300">
                        <div className="bg-slate-50 p-4 rounded-[1.25rem] border border-slate-100 flex flex-col justify-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Distance</p>
                            <p className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{distanceText}</p>
                        </div>
                        <div className="bg-indigo-50 p-4 rounded-[1.25rem] border border-indigo-100 flex flex-col justify-center">
                            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5">Estimation</p>
                            <p className="text-2xl font-black text-indigo-600 tracking-tighter leading-none">
                                {etaDisplay}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentTrackingPage;
