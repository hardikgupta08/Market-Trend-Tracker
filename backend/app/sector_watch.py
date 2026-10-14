"""Curated, forward-looking drivers to watch for each sector.

These are the recurring catalysts and data points that move each sector; they are
written to stay valid over time (no dated forecasts). The live sector brief pairs
them with signals computed from current market data and the latest sector news.
"""

WATCH = {
    "india": {
        "banking": [
            "RBI policy rate path and system liquidity — sets deposit costs and net interest margins",
            "Credit growth vs deposit growth, and CASA ratio trends in quarterly results",
            "Asset quality in unsecured retail, credit cards and microfinance (slippages, provisions)",
            "Bond yields (treasury gains for PSU banks) and any capital raising or divestment",
        ],
        "finserv": [
            "NBFC/HFC borrowing costs and disbursement growth as rates move",
            "Capital-market activity: demat additions, F&O volumes and SEBI derivative rules (brokers, exchanges, depositories)",
            "Monthly SIP inflows and equity AUM growth for asset managers (AMFI data)",
            "Insurance: new-business margins (VNB), premium growth and IRDAI/GST rule changes",
        ],
        "it": [
            "US/Europe discretionary tech spending and large deal wins (TCV) in quarterly results",
            "Revenue-growth guidance revisions and margin commentary from the large caps",
            "USD/INR — a weaker rupee lifts reported earnings",
            "GenAI: deflation in legacy services vs new AI deal pipeline; US visa and outsourcing policy",
        ],
        "pharma": [
            "US FDA inspection outcomes, warning letters and import alerts at key plants",
            "US generic price erosion vs complex/specialty launches and patent-expiry opportunities",
            "US tariff and drug-pricing policy affecting Indian exporters",
            "Domestic formulation growth (IPM data) and hospital bed additions / ARPOB",
        ],
        "auto": [
            "Monthly sales volumes (released on the 1st) across PV, 2W, tractors and CVs",
            "Rural demand, monsoon and festive-season retail registrations (VAHAN)",
            "EV adoption, PLI incentives and commodity costs (steel, aluminium, rare earths)",
            "Regulatory changes: emission norms, safety rules and GST rates",
        ],
        "fmcg": [
            "Rural vs urban volume growth; monsoon and food inflation",
            "Input costs: palm oil, crude derivatives, milk, wheat, cocoa",
            "Price hikes vs volume trade-off; channel shift to quick commerce",
            "Competition from D2C and regional brands squeezing market share",
        ],
        "metals": [
            "China steel output, exports and stimulus — sets global prices",
            "LME aluminium, copper and zinc; iron ore and coking coal costs",
            "Safeguard / anti-dumping duties on steel imports",
            "Domestic infrastructure and construction demand; capacity additions",
        ],
        "energy": [
            "Brent crude: upstream realisations vs oil-marketing margins",
            "Refining margins (GRMs) and administered gas pricing",
            "Power demand growth, peak demand and thermal plant load factors",
            "Renewable and green-hydrogen capacity additions; coal production",
        ],
        "capgoods": [
            "Order inflows and execution in quarterly results; government capex in the Union Budget",
            "Defence procurement, indigenisation and export orders",
            "Private capex cycle and PLI-led manufacturing investments",
            "Power T&D and data-centre orders; valuations leave little room for misses",
        ],
        "infra": [
            "Government capex run-rate for roads, railways and ports (monthly spend data)",
            "Port cargo volumes, rail freight and air traffic data",
            "EPC order books, working capital and interest costs",
            "Logistics demand: GST e-way bill generation trends",
        ],
        "cement": [
            "Monthly dispatch volumes and regional cement prices",
            "Fuel costs: pet coke and imported coal",
            "Industry consolidation and capacity additions by the large players",
            "Housing and infrastructure demand; monsoon-season seasonality",
        ],
        "chemicals": [
            "Chinese pricing and dumping in specialty chemicals; China+1 sourcing wins",
            "Agrochemical channel inventory and kharif/rabi sowing",
            "Fertiliser subsidy allocations and gas prices",
            "Crude-linked raw material costs and export demand",
        ],
        "realty": [
            "Pre-sales and new launches reported by listed developers",
            "Home-loan rates and unsold inventory in the top cities",
            "Hotel RevPAR and occupancy; office leasing and REIT occupancy",
            "Land acquisition, approvals and RERA developments",
        ],
        "consumer": [
            "Discretionary demand through festive and wedding seasons",
            "Quick-commerce and e-commerce growth vs path to profitability",
            "Summer-season demand for cooling products; electronics PLI",
            "Rich valuations — earnings delivery needs to keep pace",
        ],
        "telecom": [
            "Tariff hikes and ARPU trajectory",
            "5G capex and monetisation; Vodafone Idea funding and AGR dues",
            "Monthly subscriber additions (TRAI data)",
            "Media: ad spending, streaming subscriptions and sports-rights costs",
        ],
    },
    "world": {
        "tech": [
            "Hyperscaler AI capex guidance in quarterly results — the key demand signal for chips and networking",
            "Semiconductor cycle, US–China export controls and tariffs on hardware",
            "Enterprise software spending and AI-driven pressure on seat-based pricing",
            "Mega-cap concentration and valuations; earnings must keep validating multiples",
        ],
        "financials": [
            "Fed rate path and yield-curve shape — drives bank net interest margins",
            "Credit quality: card charge-offs, commercial real estate, private credit",
            "Capital rules (Basel III endgame), stress tests and buyback capacity",
            "Investment-banking activity: M&A, IPO pipeline and trading volumes",
        ],
        "healthcare": [
            "Drug-pricing policy (IRA negotiation, most-favoured-nation pricing) and pharma tariffs",
            "GLP-1 obesity drug demand, supply and competition",
            "Patent cliffs and M&A activity among large pharma",
            "Managed-care medical cost trends and Medicare Advantage rates",
        ],
        "discretionary": [
            "Consumer spending, real wage growth and monthly retail sales",
            "Tariffs on imported goods and their pass-through to prices",
            "Auto and EV demand and pricing; Tesla and Amazon dominate the index weight",
            "Travel, leisure and restaurant traffic trends",
        ],
        "communication": [
            "Digital advertising growth and AI's effect on search and social engagement",
            "Streaming subscriber growth, price increases and churn",
            "Antitrust and regulatory cases involving the platform giants",
            "AI capex intensity vs free-cash-flow at Alphabet and Meta",
        ],
        "industrials": [
            "ISM manufacturing PMI and new orders",
            "Aerospace delivery ramps, supply-chain bottlenecks and defence budgets",
            "Data-centre power buildout, reshoring and infrastructure spending (electrical equipment)",
            "Freight and transport volumes; tariff impact on supply chains",
        ],
        "staples": [
            "Volume growth vs pricing as inflation cools",
            "GLP-1 drugs' effect on food and snack consumption",
            "Input costs: cocoa, coffee, grains, packaging",
            "Defensive rotation when markets turn risk-off",
        ],
        "energy": [
            "OPEC+ production decisions and spare capacity",
            "Global oil demand, especially China, and inventory data (weekly EIA)",
            "US shale output and capital discipline (buybacks vs growth)",
            "Natural gas prices and LNG export capacity; geopolitical supply risk",
        ],
        "utilities": [
            "Electricity demand growth from data centres and AI",
            "Interest rates — utilities trade as bond proxies",
            "Rate-case outcomes and multi-year capex plans",
            "Nuclear, renewables and grid policy and tax credits",
        ],
        "realestate": [
            "10-year Treasury yield and the rate-cut path",
            "Office vacancy and refinancing of maturing loans",
            "Data-centre, industrial and cell-tower REIT demand",
            "Cap rates and transaction volumes",
        ],
        "materials": [
            "China demand and stimulus for metals and chemicals",
            "Copper and gold prices; US dollar strength",
            "Tariffs on steel, aluminium and other imported materials",
            "Agricultural inputs (fertiliser) and housing-related demand",
        ],
    },
}
