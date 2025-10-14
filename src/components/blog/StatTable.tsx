"use client";


type Row = {
    label: string;
    total?: string | number;
    perGame?: string | number;
    value?: string;
};

interface Props {
    title?: string;
    rows: Row[];
}

export default function StatTable({ title, rows }: Props) {
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
                        <th className="px-3 py-2 text-left">Stat</th>
                        <th className="px-3 py-2 text-center">Total</th>
                        <th className="px-3 py-2 text-center">Per-Game</th>
                        <th className="px-3 py-2 text-center">Category Value</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr
                            key={i}
                            className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                        >
                            <td className="px-3 py-2 font-medium">{r.label}</td>
                            <td className="px-3 py-2 text-center">{r.total ?? "—"}</td>
                            <td className="px-3 py-2 text-center">{r.perGame ?? "—"}</td>
                            <td className="px-3 py-2 text-center">{r.value ?? ""}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
