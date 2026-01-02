import { useState } from 'react';
import {
    Globe, Check, MapPin, Building2, Flag
} from 'lucide-react';
import clsx from 'clsx';

const COUNTRIES = [
    {
        id: 'US',
        name: 'United States',
        flag: '🇺🇸',
        status: 'Fully Configured',
        systems: 'Federal + State + Local',
        features: 'Complete Automation',
        active: true
    },
    {
        id: 'BH',
        name: 'Bahrain',
        flag: '🇧🇭',
        status: 'Available',
        systems: 'VAT, Corporate Tax',
        features: 'Full Support',
        active: false
    },
    {
        id: 'AE',
        name: 'United Arab Emirates',
        flag: '🇦🇪',
        status: 'Available',
        systems: 'VAT, Corporate Tax, Excise',
        features: 'Full Support',
        active: false
    },
    {
        id: 'PK',
        name: 'Pakistan',
        flag: '🇵🇰',
        status: 'Available',
        systems: 'Sales Tax, Income Tax, FED',
        features: 'Full Support',
        active: false
    }
];

export default function CountrySetup() {
    const [selectedCountry, setSelectedCountry] = useState('US');
    const [multiCountry, setMultiCountry] = useState(false);

    return (
        <div className="flex flex-col h-full bg-redwood-bg-light overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-redwood-border p-6 flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-black text-redwood-text-main uppercase tracking-tighter flex items-center gap-3">
                        <Globe className="text-redwood-brand" /> Country Configuration
                    </h1>
                    <p className="text-xs font-bold text-redwood-text-muted uppercase tracking-widest mt-1">
                        Global Tax Jurisdictions
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-8 text-center">
                        <h2 className="text-xl font-black text-redwood-text-main mb-2">Select Your Primary Operating Country</h2>
                        <p className="text-gray-500">The system will configure tax rules, currencies, and compliance calendars based on this selection.</p>
                    </div>

                    <div className="space-y-4">
                        {COUNTRIES.map(country => (
                            <div
                                key={country.id}
                                onClick={() => setSelectedCountry(country.id)}
                                className={clsx(
                                    "relative bg-white border p-6 rounded-sm cursor-pointer transition-all hover:shadow-md flex items-center gap-6",
                                    selectedCountry === country.id
                                        ? "border-redwood-brand shadow-md ring-1 ring-redwood-brand"
                                        : "border-gray-200 hover:border-gray-300"
                                )}
                            >
                                <div className="text-4xl">{country.flag}</div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="text-lg font-black text-redwood-text-main uppercase">{country.name}</h3>
                                        {selectedCountry === country.id && (
                                            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-black uppercase flex items-center gap-1">
                                                <Check size={10} /> Selected
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 text-sm text-gray-600 mt-2">
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase block">Status</span>
                                            <span className={clsx("font-bold", country.id === 'US' ? "text-emerald-600" : "text-gray-600")}>{country.status}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase block">Tax System</span>
                                            {country.systems}
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase block">Features</span>
                                            {country.features}
                                        </div>
                                    </div>
                                </div>
                                <button className={clsx(
                                    "px-4 py-2 rounded-sm text-xs font-bold uppercase",
                                    selectedCountry === country.id
                                        ? "bg-redwood-brand text-white"
                                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                )}>
                                    {selectedCountry === country.id ? 'Configure' : 'Select'}
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="mt-12 bg-white border border-redwood-border p-6 rounded-sm">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-blue-50 rounded text-blue-600">
                                <Globe size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-black text-redwood-text-main uppercase mb-2">Multi-Country Operations</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    Does your organization operate in multiple tax jurisdictions? Enable this to manage tax compliance across borders simultaneously (e.g., US Headquarters with UAE branch).
                                </p>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={multiCountry}
                                        onChange={(e) => setMultiCountry(e.target.checked)}
                                        className="w-4 h-4 text-redwood-brand border-gray-300 rounded focus:ring-redwood-brand"
                                    />
                                    <span className="font-bold text-sm text-gray-800">Enable multi-country tax management</span>
                                </label>

                                {multiCountry && (
                                    <div className="mt-4 pl-7 animate-in fade-in slide-in-from-top-2">
                                        <button className="px-4 py-2 border border-dashed border-gray-300 rounded text-xs font-bold uppercase text-gray-500 hover:border-gray-400 hover:text-gray-700 flex items-center gap-2">
                                            + Add Additional Country
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end">
                        <button className="px-6 py-3 bg-redwood-brand text-white rounded-sm font-bold uppercase tracking-wide hover:bg-redwood-brand/90 shadow-lg">
                            Save Configuration
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}
