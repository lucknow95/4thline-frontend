"use client";


type Row = {
    week: number;
    dates: string;
    gp: number;
    offNights: number;
};

interface Props {
    title?: string;
    rows: Row[];
}

export default function PlayoffTable({ title, rows }: Props) {
    return (
        <div className="my-6 w-full overflow-x-auto">
            {title && (
                <h3 className="text-lg font-semibold mb-2 border-b border-gray-300 pb-1">
                    {title}
                </h3>
            )}
            <table className="min-w-full border border-gray-300 text-sm rounded-lg overflow-hidden">
                <thead className="bg-gray-100 text-gray-800">
                    <tr>
                        <th className="px-3 py-2 text-center">Week</th>
                        <th className="px-3 py-2 text-center">Dates</th>
                        <th className="px-3 py-2 text-center">GP</th>
                        <th className="px-3 py-2 text-center">Off-Nights 🌓 (Wed/Fri/Sun)</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={r.week} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                            <td className="px-3 py-2 text-center font-semibold">{r.week}</td>
                            <td className="px-3 py-2 text-center">{r.dates}</td>
                            <td className="px-3 py-2 text-center">{r.gp}</td>
                            <td className="px-3 py-2 text-center">{r.offNights}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
