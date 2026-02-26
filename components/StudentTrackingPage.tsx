import React, { useState, useEffect, useRef } from 'react';
import { Bus, Location } from '../types';
import MapComponent from './MapComponent';
import BottomSheet from './BottomSheet';
import { Capacitor } from '@capacitor/core';
import { googleMapsService } from '../services/googleMapsService';

interface StudentTrackingPageProps {
    selectedBus: Bus;
    studentLocation: Location | null;
    onBack: () => void;
    eta: number | null;
    isActive: boolean; // FIX 13: Strict gating prop
}

export type ViewMode = 'COLLAPSED' | 'MID' | 'EXPANDED';

const StudentTrackingPage: React.FC<StudentTrackingPageProps> = ({
    selectedBus,
    studentLocation,
    onBack,
    eta,
    isActive
}) => {
    const [viewMode, setViewMode] = useState<ViewMode>('MID');
    const [distanceText, setDistanceText] = useState<string>('--');

    // Calculate distance whenever locations change
    useEffect(() => {
        if (isActive && studentLocation && selectedBus.lastLocation) {
            const distance = googleMapsService.calculateDistance(studentLocation, selectedBus.lastLocation);
            setDistanceText(googleMapsService.formatDistance(distance || 0));
        } else if (!isActive) {
            // FIX 13: Reset distance text when bus is offline
            setDistanceText('--');
        }
    }, [studentLocation, selectedBus.lastLocation, isActive]);

    // Handle back navigation
    const handleBack = () => {
        onBack();
    };

    // Hardware Back Button
    useEffect(() => {
        let backListener: any;
        if (Capacitor.isNativePlatform()) {
            import('@capacitor/app').then(({ App }) => {
                backListener = App.addListener('backButton', () => {
                    handleBack();
                });
            });
        }
        return () => {
            if (backListener) backListener.then((l: any) => l.remove());
        };
    }, [onBack]);

    return (
        <div className="fixed inset-0 bg-white z-[60] flex flex-col overflow-hidden select-none animate-in fade-in duration-500">
            {/* Map Area - Full Screen for better experience */}
            <div className="absolute inset-0 z-0">
                <MapComponent
                    busLocation={selectedBus.lastLocation ? {
                        ...selectedBus.lastLocation,
                        isOnline: selectedBus.isOnline,
                        busNumber: selectedBus.busNumber,
                        updatedAt: selectedBus.updatedAt
                    } : undefined}
                    userLocation={studentLocation}
                    viewMode={viewMode}
                    eta={eta}
                />
            </div>

            {/* Top Navigation Bar (Back + Status) */}
            <div className="absolute top-[calc(env(safe-area-inset-top)+16px)] left-0 right-0 px-4 z-[110] flex items-center justify-between pointer-events-none">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleBack();
                    }}
                    className="w-11 h-11 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-2xl border border-slate-50 text-slate-900 active:scale-95 transition-all flex items-center justify-center pointer-events-auto"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
                </button>

                <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center gap-3 border border-white/10 pointer-events-none">
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.8)]"></div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.12em] leading-none">Bus {selectedBus.busNumber}</span>
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Live Tracking</span>
                    </div>
                </div>
            </div>

            {/* Zomato-style Draggable Bottom Sheet */}
            <BottomSheet
                bus={selectedBus}
                viewMode={viewMode}
                setViewMode={setViewMode}
                eta={eta}
                distance={distanceText}
            />
        </div>
    );
};


export default StudentTrackingPage;
