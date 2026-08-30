import React from 'react';

export default function SavedRecordsPage() {
    return (
        <div className="flex-1 overflow-y-auto p-margin-desktop bg-surface pb-24 lg:pb-margin-desktop">
            {/* Header Section */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="font-display-lg text-[32px] text-primary mb-2">Saved Records</h2>
                    <p className="font-body-lg text-body-lg text-on-surface-variant">Manage and review historical clinical intelligence data.</p>
                </div>
            </div>
            
            {/* Filters */}
            <div className="bg-surface-container-lowest border border-outline-variant p-4 rounded-xl mb-6 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="block font-body-sm text-body-sm text-on-surface-variant mb-1">Search Record ID</label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
                        <input
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-body-md text-body-md"
                            placeholder="e.g. DS-2026" type="text" />
                    </div>
                </div>
                <div className="w-48">
                    <label className="block font-body-sm text-body-sm text-on-surface-variant mb-1">Date Range</label>
                    <input
                        className="w-full px-4 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-body-md text-body-md"
                        type="date" />
                </div>
                <div className="w-48">
                    <label className="block font-body-sm text-body-sm text-on-surface-variant mb-1">Outreach Location</label>
                    <select
                        className="w-full px-4 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-body-md text-body-md appearance-none">
                        <option>All Camps</option>
                        <option>Camp Alpha</option>
                        <option>Camp Beta</option>
                        <option>Mobile Unit 1</option>
                    </select>
                </div>

                <button className="bg-surface-variant text-primary px-4 py-2 rounded-lg font-body-md text-body-md font-medium hover:bg-surface-container-high border border-outline-variant transition-colors h-[42px] flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">filter_list</span>
                    More Filters
                </button>
            </div>
            
            {/* Data Table */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr className="bg-surface-container-low border-b border-outline-variant">
                                <th className="py-3 px-4 font-headline-sm text-[14px] text-primary font-semibold">Record ID</th>
                                <th className="py-3 px-4 font-headline-sm text-[14px] text-primary font-semibold">Date/Time</th>
                                <th className="py-3 px-4 font-headline-sm text-[14px] text-primary font-semibold">Outreach Location</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/50">
                            {[
                                { id: "DS-2026-01-08", date: "Aug 01, 09:15 AM", location: "Camp Alpha" },
                                { id: "DS-2026-02-08", date: "Aug 02, 10:30 AM", location: "Camp Beta" },
                                { id: "DS-2026-03-08", date: "Aug 03, 11:45 AM", location: "Mobile Unit 1" },
                                { id: "DS-2026-04-08", date: "Aug 04, 02:10 PM", location: "Camp Alpha" }
                            ].map((row, idx) => (
                                <tr key={idx} className="hover:bg-surface-container-lowest/50 transition-colors group">
                                    <td className="py-4 px-4 font-body-md text-body-md text-primary font-medium">
                                        <div className="flex items-center gap-2">{row.id}-[Cryptographic Nano ID]</div>
                                    </td>
                                    <td className="py-4 px-4 font-body-md text-body-md text-on-surface-variant">
                                        <div className="flex items-center gap-2">{row.date}</div>
                                    </td>
                                    <td className="py-4 px-4 font-body-md text-body-md text-on-surface-variant">
                                        <div className="flex items-center gap-2">{row.location}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                {/* Pagination */}
                <div className="bg-surface-container-lowest border-t border-outline-variant px-4 py-3 flex items-center justify-between flex-wrap gap-4">
                    <div className="font-body-sm text-body-sm text-on-surface-variant">
                        Showing <span className="font-medium text-primary">1</span> to <span className="font-medium text-primary">10</span> of <span className="font-medium text-primary">97</span> results
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="p-1 rounded text-outline hover:text-primary hover:bg-surface-variant transition-colors disabled:opacity-50" disabled>
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <button className="w-8 h-8 rounded bg-primary text-on-primary font-body-sm text-body-sm font-medium flex items-center justify-center">1</button>
                        <button className="w-8 h-8 rounded text-on-surface hover:bg-surface-variant transition-colors font-body-sm text-body-sm font-medium flex items-center justify-center">2</button>
                        <button className="w-8 h-8 rounded text-on-surface hover:bg-surface-variant transition-colors font-body-sm text-body-sm font-medium flex items-center justify-center">3</button>
                        <span className="text-outline">...</span>
                        <button className="w-8 h-8 rounded text-on-surface hover:bg-surface-variant transition-colors font-body-sm text-body-sm font-medium flex items-center justify-center">10</button>
                        <button className="p-1 rounded text-outline hover:text-primary hover:bg-surface-variant transition-colors">
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
