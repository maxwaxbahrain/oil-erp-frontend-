import { ChevronRight, Landmark } from 'lucide-react';

interface BankAccount {
    bank: string;
    account: string;
    balance: string;
    status: 'Reconciled' | 'In Review' | 'Manual';
}

const banks: BankAccount[] = [
    { bank: 'MAIN OPERATING ACCOUNT', account: 'BETTANO-LLC-PRIMARY', balance: 'Live', status: 'Reconciled' },
    { bank: 'MEEZAN ISLAMIC BUSINESS', account: '99-8821-4-OPERATIONS', balance: '4,285,420', status: 'In Review' },
    { bank: 'STANDARD CHARTERED CORE', account: '11-4412-1-SUPPLY', balance: '2,800,000', status: 'Reconciled' },
    { bank: 'CENTRAL OPERATIONAL FUND', account: '00-0000-0-DRAWER', balance: '45,000', status: 'Manual' },
];

export default function GeneralLedger() {
    return (
        <div className="bg-white rounded-sm border border-redwood-border shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            <div className="p-5 border-b border-redwood-bg-light bg-redwood-bg-light/30 flex justify-between items-center">
                <h3 className="text-[12px] font-black text-redwood-text-main flex items-center gap-3 uppercase tracking-[0.2em]">
                    <Landmark size={18} className="text-redwood-primary" /> Corporate Liquidity Centers
                </h3>
                <button className="text-[10px] font-black text-redwood-primary uppercase hover:underline tracking-widest">Manage All Maps</button>
            </div>
            <div className="divide-y divide-redwood-bg-light/50 flex-1">
                {banks.map((bank, i) => (
                    <div key={i} className="p-6 flex items-center justify-between hover:bg-redwood-bg-light/20 group cursor-pointer border-l-4 border-transparent hover:border-l-redwood-primary transition-all">
                        <div className="flex items-center gap-5 text-[13px]">
                            <div className="w-12 h-12 rounded-sm bg-white border border-redwood-border flex items-center justify-center font-black text-redwood-text-muted text-[11px] shadow-inner group-hover:border-redwood-primary transition-colors">
                                #0{i + 1}
                            </div>
                            <div>
                                <div className="font-black text-redwood-text-main tracking-tight truncate max-w-[300px] uppercase">{bank.bank}</div>
                                <div className="text-[10px] text-redwood-text-muted font-bold tracking-widest mt-1">
                                    REF: {bank.account}
                                </div>
                            </div>
                        </div>
                        <div className="text-right flex items-center gap-8">
                            <div>
                                <div className="text-[15px] font-black text-redwood-text-main font-mono">{bank.balance}</div>
                                <div className={`text-[9px] font-black uppercase tracking-widest mt-1 flex items-center justify-end gap-1.5 ${bank.status === 'Reconciled' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${bank.status === 'Reconciled' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></div>
                                    {bank.status}
                                </div>
                            </div>
                            <ChevronRight size={20} className="text-redwood-border group-hover:text-redwood-primary transition-all translate-x-1" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
