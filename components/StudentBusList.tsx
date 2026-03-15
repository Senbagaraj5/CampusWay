import React, { useMemo } from 'react';
import { Bus, Location } from '../types';
import { isBusActive } from '../services/locationUtils';
import L from 'leaflet';
import { googleMapsService } from '../services/googleMapsService';

interface StudentBusListProps {
    buses: Bus[];
    studentLocation: Location | null;
    onSelectBus: (bus: Bus) => void;
}

export const StudentBusCard = React.memo(({ 
    bus, 
    onClick, 
    isSelected, 
    isDriverView, 
    studentLocation 
}: { 
    bus: Bus; 
    onClick: () => void;
    isSelected?: boolean;
    isDriverView?: boolean;
    studentLocation?: Location | null;
}) => {
    // FIX 5, 12, 14: Use unified utility to reject [0,0] and check staleness
    const isLive = isBusActive(bus);

    let borderClass = 'border-slate-100';
    let scaleClass = 'active:scale-[0.97]';
    let shadowClass = 'shadow-sm';
    
    // Driver mode styling overrides
    if (isDriverView && isSelected) {
        borderClass = 'border-indigo-600 bg-indigo-50/40 text-indigo-900';
        scaleClass = 'scale-[1.02] active:scale-[1.02] z-10'; // Keep it scaled up
    } else if (!isDriverView && isLive) {
        borderClass = 'border-green-400 bg-green-50/10 shadow-[0_0_15px_rgba(34,197,94,0.15)] ring-1 ring-green-400/50';
    }

    let etaText = '';
    if (!isDriverView && isLive && studentLocation && bus.location) {
        const distMeters = L.latLng(studentLocation.lat, studentLocation.lng).distanceTo(L.latLng(bus.location.lat, bus.location.lng));
        const timeMins = Math.ceil((distMeters / 1000 / 25) * 60); // 25km/h city avg
        
        const dStr = googleMapsService.formatDistance(distMeters);
        const tStr = googleMapsService.formatETA(timeMins);
        
        if (dStr !== '--' && tStr !== '--') {
            etaText = `${dStr} • ${tStr}`;
        }
    }

    return (
        <button
            onClick={onClick}
            className={`group relative flex flex-col p-4 bg-white rounded-2xl border-2 transition-all duration-300 text-left w-full overflow-hidden select-none tap-transparent min-h-[140px] ${borderClass} ${scaleClass} ${shadowClass}`}
            style={{ WebkitTapHighlightColor: 'transparent', userSelect: 'none' }}
        >
            <div className="flex items-start justify-between mb-auto w-full">
                {/* Large dark bus number */}
                <div className="text-4xl font-[800] text-slate-800 tracking-tighter leading-none -ml-1 -mt-1">
                    {bus.busNumber}
                </div>

                {/* Status Indicator */}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border shrink-0 bg-white/80 backdrop-blur whitespace-nowrap ${
                    isDriverView && isSelected ? 'border-indigo-200' :
                    (!isDriverView && isLive) ? 'border-green-200' : 'border-slate-100'
                }`}>
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isDriverView && isSelected ? 'bg-indigo-500' :
                        (!isDriverView && isLive) ? 'bg-green-500 animate-pulse' : 'bg-slate-300'
                    }`}></div>
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${
                        isDriverView && isSelected ? 'text-indigo-600' :
                        (!isDriverView && isLive) ? 'text-green-600' : 'text-slate-400'
                    }`}>
                        {isDriverView && isSelected ? 'SELECTED' : (!isDriverView && isLive) ? 'LIVE' : 'OFFLINE'}
                    </span>
                </div>
            </div>

            <div className="mt-6 w-full relative z-10 flex flex-col overflow-hidden">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest leading-none mb-1.5 whitespace-nowrap overflow-hidden text-ellipsis">Bus Route</p>
                <h3 className="text-sm font-bold text-slate-900 leading-tight whitespace-nowrap overflow-hidden text-ellipsis w-full">Bus {bus.busNumber}</h3>
                <p className="text-[11px] font-normal text-slate-500 mt-1 whitespace-nowrap overflow-hidden text-ellipsis w-full">
                    {bus.route}
                </p>
                {etaText && (
                    <p className="text-[10px] font-bold text-indigo-600 mt-1 animate-in fade-in">
                        {etaText}
                    </p>
                )}
            </div>
        </button>
    );
});

const StudentBusList: React.FC<StudentBusListProps> = React.memo(({ buses, studentLocation, onSelectBus }) => {
    // FIX 5: Sort active (LIVE) fleets to the top
    const sortedBuses = useMemo(() => {
        return [...buses].sort((a, b) => {
            const isALive = isBusActive(a);
            const isBLive = isBusActive(b);

            if (isALive && !isBLive) return -1;
            if (!isALive && isBLive) return 1;

            // Secondary sort by bus number
            return parseInt(a.busNumber) - parseInt(b.busNumber);
        });
    }, [buses]);

    return (
        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
            <div className="text-center px-4">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tighter">Campus Fleet</h2>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-2">Active Units & Tracking</p>
            </div>

            <div className="grid grid-cols-2 gap-3 px-4">
                {sortedBuses.map((bus) => (
                    <div key={bus.id} className="w-full flex">
                       <StudentBusCard
                           bus={bus}
                           studentLocation={studentLocation}
                           onClick={() => onSelectBus(bus)}
                       />
                    </div>
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
});

export default StudentBusList;
