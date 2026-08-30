import React from 'react';
import ReportCard from '@/components/reports/ReportCard';

// Mock data representing records
const mockReports = [
    {
        id: 'DS-2026-01-08-NANO-1A2B',
        date: '2026-08-01',
        time: '09:15 AM',
        location: 'Camp Alpha',
        workerName: 'Dr. Egabo Aaron',
        transcript: 'Patient presents with mild fever and fatigue. Administered rapid malaria test, results pending. Prescribed paracetamol for symptom management. Advised to return if symptoms worsen over the next 48 hours.'
    },
    {
        id: 'DS-2026-01-08-NANO-3C4D',
        date: '2026-08-01',
        time: '11:30 AM',
        location: 'Camp Alpha',
        workerName: 'Dr. Egabo Aaron',
        transcript: 'Routine checkup for pregnant mother in second trimester. Blood pressure normal. Prescribed standard prenatal vitamins and scheduled next visit in 4 weeks.'
    },
    {
        id: 'DS-2026-02-08-NANO-5E6F',
        date: '2026-08-02',
        time: '10:30 AM',
        location: 'Camp Beta',
        workerName: 'Sarah Jenkins, RN',
        transcript: 'Mass vaccination drive for pediatric ward. Administered polio drops to 45 infants. No adverse reactions observed during the monitoring period.'
    },
    {
        id: 'DS-2026-04-08-NANO-7G8H',
        date: '2026-08-04',
        time: '02:10 PM',
        location: 'Mobile Unit 1',
        workerName: 'Dr. Egabo Aaron',
        transcript: 'Emergency trauma assessment following vehicular accident. Patient stabilized, minor lacerations sutured. Referred to central hospital for x-ray of left femur.'
    }
];

export default function ReportsGeneratorPage() {
    // Group reports by month/year and then by day
    const groupedReports = mockReports.reduce((acc, report) => {
        const dateObj = new Date(report.date);
        const monthYear = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const day = dateObj.toLocaleDateString('en-US', { day: 'numeric', month: 'long' });

        if (!acc[monthYear]) {
            acc[monthYear] = {};
        }
        if (!acc[monthYear][day]) {
            acc[monthYear][day] = [];
        }
        acc[monthYear][day].push(report);
        return acc;
    }, {} as Record<string, Record<string, typeof mockReports>>);

    return (
        <div className="flex-1 overflow-y-auto p-margin-desktop bg-surface pb-24 lg:pb-margin-desktop">
            {/* Header Section */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="font-display-lg text-[32px] text-primary mb-2">Reports Generator</h2>
                    <p className="font-body-lg text-body-lg text-on-surface-variant">View and export clinical records as highly detailed, print-ready field reports.</p>
                </div>
            </div>

            {/* Reports Feed */}
            <div className="flex flex-col gap-12">
                {Object.entries(groupedReports).map(([monthYear, days]) => (
                    <div key={monthYear} className="flex flex-col gap-8">
                        {/* Month/Year Header */}
                        <div className="sticky top-0 z-20 bg-surface/90 backdrop-blur-md py-4 border-b-2 border-secondary/20">
                            <h2 className="text-2xl font-display-lg font-bold text-primary">{monthYear}</h2>
                        </div>

                        <div className="flex flex-col gap-10">
                            {Object.entries(days).map(([day, reports]) => (
                                <div key={day} className="flex flex-col gap-6">
                                    {/* Day Header */}
                                    <div className="flex items-center gap-4">
                                        <div className="h-px bg-outline-variant/30 flex-1"></div>
                                        <h3 className="text-sm font-bold tracking-widest uppercase text-secondary">{day}</h3>
                                        <div className="h-px bg-outline-variant/30 flex-1"></div>
                                    </div>

                                    {/* Reports Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                        {reports.map((report) => (
                                            <ReportCard 
                                                key={report.id}
                                                recordId={report.id}
                                                datetime={`${new Date(report.date).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}, ${report.time}`}
                                                location={report.location}
                                                workerName={report.workerName}
                                                transcript={report.transcript}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
