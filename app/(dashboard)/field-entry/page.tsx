import React from 'react';

export default function FieldEntryPage() {
    return (
        <main className="flex-1 overflow-y-auto p-margin-desktop pb-24 lg:pb-margin-desktop">
            <div className="max-w-7xl mx-auto grid grid-cols-12 gap-gutter">
                {/* Left Panel: Dictation Workspace (Spans 12 cols in this view) */}
                <section className="col-span-12 flex flex-col gap-gutter">
                    {/* Main Dictation Interface */}
                    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-lg flex-1 flex flex-col relative dictating ambient-shadow min-h-[calc(100vh-160px)]">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex bg-surface-container-low p-1 rounded-lg border border-outline-variant/30">
                                <button className="px-4 py-1.5 bg-secondary text-on-secondary rounded-md font-medium text-body-md transition-all shadow-sm">
                                    Dictation
                                </button>
                                <button className="px-4 py-1.5 text-on-surface-variant hover:bg-surface-container-high rounded-md font-medium text-body-md transition-all">
                                    Manual Entry
                                </button>
                            </div>
                            <div className="flex items-center gap-2 font-label-status text-secondary bg-secondary-container/20 px-3 py-1 rounded-full shadow-[0_0_15px_rgba(0,107,92,0.3)]">
                                <span className="w-2 h-2 bg-secondary rounded-full animate-pulse"></span>
                                LIVE RECORDING
                            </div>
                        </div>

                        <div id="unified-card-body" className="flex-1 flex flex-col">
                            {/* Dictation View (Default) */}
                            <div className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-xl flex flex-col mb-6 relative overflow-hidden h-full"
                                style={{
                                    backgroundImage: "radial-gradient(rgba(0, 107, 92, 0.063) 1px, transparent 1px)",
                                    backgroundSize: "20px 20px"
                                }}>
                                <div className="flex-1 flex items-center justify-center gap-1.5 px-8">
                                    <div className="flex items-center gap-1.5 h-32">
                                        <div className="w-1.5 bg-secondary rounded-full h-8 animate-[pulse_1.2s_ease-in-out_infinite]"></div>
                                        <div className="w-1.5 bg-secondary/60 rounded-full h-16 animate-[pulse_1.5s_ease-in-out_infinite_0.1s]"></div>
                                        <div className="w-1.5 bg-secondary/80 rounded-full h-24 animate-[pulse_1s_ease-in-out_infinite_0.2s]"></div>
                                        <div className="w-1.5 bg-secondary rounded-full h-32 animate-[pulse_0.8s_ease-in-out_infinite_0.3s]"></div>
                                        <div className="w-1.5 bg-secondary/80 rounded-full h-20 animate-[pulse_1.3s_ease-in-out_infinite_0.4s]"></div>
                                        <div className="w-1.5 bg-secondary/60 rounded-full h-12 animate-[pulse_1.1s_ease-in-out_infinite_0.5s]"></div>
                                        <div className="w-1.5 bg-secondary rounded-full h-28 animate-[pulse_0.9s_ease-in-out_infinite_0.6s]"></div>
                                        <div className="w-1.5 bg-secondary/70 rounded-full h-14 animate-[pulse_1.4s_ease-in-out_infinite_0.7s]"></div>
                                        <div className="w-1.5 bg-secondary rounded-full h-22 animate-[pulse_1.2s_ease-in-out_infinite_0.8s]"></div>
                                        <div className="w-1.5 bg-secondary/50 rounded-full h-10 animate-[pulse_1.6s_ease-in-out_infinite_0.9s]"></div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="flex gap-3">
                                    <button className="h-12 px-6 bg-secondary text-on-secondary rounded-lg font-headline-sm flex items-center gap-2 hover:bg-secondary/90 transition-all shadow-lg shadow-secondary/20">
                                        <span className="material-symbols-outlined icon-fill">mic</span>
                                        Start
                                    </button>
                                    <button className="h-12 px-6 border-2 border-secondary text-secondary rounded-lg font-headline-sm flex items-center gap-2 hover:bg-secondary/5 transition-all">
                                        <span className="material-symbols-outlined">pause</span>
                                        Pause
                                    </button>
                                    <button className="h-12 px-6 bg-error text-on-error rounded-lg font-headline-sm flex items-center gap-2 hover:bg-error/90 transition-all">
                                        <span className="material-symbols-outlined icon-fill">stop</span>
                                        Stop
                                    </button>
                                </div>

                                <button className="h-12 px-8 bg-primary text-on-primary rounded-lg font-headline-sm flex items-center gap-2 hover:bg-primary/90 transition-all shadow-lg">
                                    <span className="material-symbols-outlined">save</span>
                                    Add to Record
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
                {/* Right Panel: Manual Entry & Data (Spans 4 cols) - Placeholder for future */}
            </div>
        </main>
    );
}
