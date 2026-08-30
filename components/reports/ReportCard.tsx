'use client';

import React from 'react';
import Image from 'next/image';

interface ReportCardProps {
    recordId: string;
    datetime: string;
    location: string;
    workerName: string;
    transcript: string;
}

export default function ReportCard({ recordId, datetime, location, workerName, transcript }: ReportCardProps) {
    const handleDownload = () => {
        // In a real application, this would invoke a PDF generation library like jspdf/html2canvas,
        // or trigger a server-side PDF generation endpoint.
        // For MVP, we invoke the browser print dialog.
        window.print();
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow duration-200">
            {/* Card Header */}
            <div className="p-6 border-b border-outline-variant/30 bg-surface-container-lowest flex flex-col items-center justify-center relative">
                <div className="w-12 h-12 rounded-lg p-1 bg-white shadow-sm border border-outline-variant/20 mb-3 flex items-center justify-center">
                    <Image 
                        src="/assets/DaktariScribe-Favicon.png" 
                        alt="DaktariScribe Logo" 
                        width={40} 
                        height={40} 
                        className="object-contain" 
                    />
                </div>
                <h3 className="font-headline-md text-primary text-[20px] font-bold tracking-tight uppercase">Field Report</h3>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-3 gap-4 p-4 bg-surface-container-low border-b border-outline-variant/30 text-center">
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-variant mb-1">Record ID</span>
                    <span className="font-body-sm font-medium text-primary bg-white py-1 px-2 rounded border border-outline-variant/30 break-all">{recordId}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-variant mb-1">Date / Time</span>
                    <span className="font-body-sm font-medium text-primary bg-white py-1 px-2 rounded border border-outline-variant/30">{datetime}</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-variant mb-1">Location</span>
                    <span className="font-body-sm font-medium text-primary bg-white py-1 px-2 rounded border border-outline-variant/30">{location}</span>
                </div>
            </div>

            {/* Card Body (Transcript) */}
            <div className="p-6 flex-1 bg-white">
                <div className="mb-4">
                    <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-variant mb-1 block">Healthcare Worker</span>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-bold text-xs">
                            {workerName.charAt(0)}
                        </div>
                        <span className="font-body-md font-semibold text-primary">{workerName}</span>
                    </div>
                </div>

                <div>
                    <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-on-surface-variant mb-2 block">Clinical Recording</span>
                    <div className="relative">
                        <span className="absolute top-0 left-0 text-4xl text-outline-variant/30 font-serif leading-none select-none">"</span>
                        <div className="p-4 pt-5 pb-5 bg-surface-bright border border-outline-variant/20 rounded-xl rounded-tl-none font-body-md text-on-surface leading-relaxed relative z-10 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
                            {transcript}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer / Actions */}
            <div className="p-4 border-t border-outline-variant/30 bg-surface flex flex-col gap-4">
                <p className="text-[9px] text-on-surface-variant leading-tight text-center px-4 opacity-80">
                    This report was generated automatically by DaktariScribe Clinical Network. Information contained herein is strictly confidential and intended for authorized medical personnel only.
                </p>
                <button 
                    onClick={handleDownload}
                    className="w-full py-2.5 bg-primary text-white rounded-lg font-body-sm font-medium flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-sm"
                >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                    Download as PDF
                </button>
            </div>
        </div>
    );
}
