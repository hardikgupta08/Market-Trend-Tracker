"""Global market universe: world indices, macro instruments and GICS sector constituents.

Sector benchmarks are the SPDR Select Sector ETFs. Constituents are the largest
US-listed names in each sector plus major international ADRs.
"""

SUFFIX = ""

INDICES = [
    ("^GSPC", "S&P 500"),
    ("^DJI", "Dow Jones"),
    ("^IXIC", "Nasdaq Composite"),
    ("^NDX", "Nasdaq 100"),
    ("^RUT", "Russell 2000"),
    ("^VIX", "CBOE VIX"),
    ("^GSPTSE", "S&P/TSX"),
    ("^BVSP", "Bovespa"),
    ("^MXX", "IPC Mexico"),
    ("^FTSE", "FTSE 100"),
    ("^GDAXI", "DAX"),
    ("^FCHI", "CAC 40"),
    ("^STOXX50E", "Euro Stoxx 50"),
    ("^AEX", "AEX"),
    ("^IBEX", "IBEX 35"),
    ("FTSEMIB.MI", "FTSE MIB"),
    ("^SSMI", "SMI"),
    ("^N225", "Nikkei 225"),
    ("^HSI", "Hang Seng"),
    ("000001.SS", "Shanghai Composite"),
    ("^KS11", "KOSPI"),
    ("^TWII", "Taiwan Weighted"),
    ("^AXJO", "S&P/ASX 200"),
    ("^STI", "Straits Times"),
    ("^NSEI", "NIFTY 50"),
]

MACRO = [
    ("^TNX", "US 10Y Yield"),
    ("DX-Y.NYB", "US Dollar Index"),
    ("EURUSD=X", "EUR/USD"),
    ("USDJPY=X", "USD/JPY"),
    ("GBPUSD=X", "GBP/USD"),
    ("GC=F", "Gold"),
    ("SI=F", "Silver"),
    ("HG=F", "Copper"),
    ("CL=F", "WTI Crude"),
    ("BZ=F", "Brent Crude"),
    ("NG=F", "Natural Gas"),
    ("BTC-USD", "Bitcoin"),
    ("ETH-USD", "Ethereum"),
]

NEWS_FEEDS = [
    ("CNBC", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114"),
    ("CNBC World", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362"),
    ("MarketWatch", "https://feeds.content.dowjones.io/public/rss/mw_topstories"),
    ("Google News", "https://news.google.com/rss/search?q=stock+market+wall+street+global+markets&hl=en-US&gl=US&ceid=US:en"),
]

NEWS_LOCALE = {"hl": "en-US", "gl": "US", "ceid": "US:en"}

SECTORS = [
    {
        "id": "tech",
        "name": "Information Technology",
        "index": "XLK",
        "news_query": "technology stocks semiconductors",
        "symbols": """AAPL MSFT NVDA AVGO ORCL CRM AMD ADBE CSCO ACN IBM INTU NOW QCOM TXN AMAT MU LRCX
            KLAC ADI PANW SNPS CDNS INTC ANET FTNT ADSK CRWD MRVL APH MSI ROP NXPI MCHP DELL HPQ
            HPE WDAY TEL GLW IT CTSH KEYS ON MPWR FICO TYL PLTR SMCI STX WDC NTAP ZBRA TER TSM
            ASML SAP SONY SHOP""",
    },
    {
        "id": "financials",
        "name": "Financials",
        "index": "XLF",
        "news_query": "bank stocks financials Wall Street",
        "symbols": """BRK-B JPM V MA BAC WFC GS MS C SCHW BLK SPGI AXP PYPL CB MMC PGR AON ICE CME MCO
            USB PNC TFC COF MET PRU AIG AFL ALL TRV  STT FITB HBAN RF KEY MTB CFG NTRS TROW BEN
            IVZ AMP RJF HIG CINF WRB L BX KKR APO ARES HSBC RY TD UBS MUFG ING SAN""",
    },
    {
        "id": "healthcare",
        "name": "Health Care",
        "index": "XLV",
        "news_query": "healthcare pharma biotech stocks",
        "symbols": """LLY UNH JNJ ABBV MRK PFE TMO ABT DHR AMGN ISRG BMY GILD VRTX REGN MDT SYK BSX ELV
            CI CVS HCA ZTS BDX EW IDXX IQV A MTD RMD DXCM BIIB MRNA HUM CNC MCK COR CAH GEHC BAX
            STE WST ZBH HOLX ALGN COO PODD LH DGX NVO AZN NVS SNY GSK TAK""",
    },
    {
        "id": "discretionary",
        "name": "Consumer Discretionary",
        "index": "XLY",
        "news_query": "consumer discretionary retail auto stocks",
        "symbols": """AMZN TSLA HD MCD NKE LOW SBUX TJX BKNG CMG ABNB ORLY AZO MAR HLT ROST GM F LULU
            YUM DHI LEN PHM NVR EBAY ETSY DPZ DRI RCL CCL NCLH LVS WYNN MGM EXPE TSCO ULTA BBY
            GPC POOL KMX DECK RL TPR HAS LKQ APTV BABA PDD MELI JD TM HMC RACE""",
    },
    {
        "id": "communication",
        "name": "Communication Services",
        "index": "XLC",
        "news_query": "media telecom internet stocks",
        "symbols": """GOOGL META NFLX DIS CMCSA T VZ TMUS CHTR  TTWO WBD  OMC FOXA NWSA LYV
            MTCH SPOT RDDT PINS SNAP RBLX ROKU TME BIDU NTES SE BILI  VOD BCE TU AMX CHT
            SKM KT""",
    },
    {
        "id": "industrials",
        "name": "Industrials",
        "index": "XLI",
        "news_query": "industrial aerospace defense stocks",
        "symbols": """GE CAT RTX HON UNP UPS BA LMT DE ADP ETN GD NOC ITW MMM EMR CSX NSC WM RSG FDX PH
            JCI TT CARR OTIS PCAR CMI ROK AME FAST PWR URI GWW ODFL CTAS PAYX VRSK EFX LHX TDG
            HWM DAL UAL LUV AAL WAB IR XYL DOV SNA SWK J LDOS CPRT UBER AXON GEV HII TXT""",
    },
    {
        "id": "staples",
        "name": "Consumer Staples",
        "index": "XLP",
        "news_query": "consumer staples food beverage stocks",
        "symbols": """WMT COST PG KO PEP PM MO MDLZ CL KMB GIS KHC HSY STZ KDP MNST SYY KR TGT DG
            DLTR ADM BG TSN HRL CAG SJM CPB MKC CHD CLX EL BF-B TAP KVUE DEO UL BTI BUD""",
    },
    {
        "id": "energy",
        "name": "Energy",
        "index": "XLE",
        "news_query": "oil gas energy stocks",
        "symbols": """XOM CVX COP EOG SLB OXY PSX MPC VLO WMB KMI OKE DVN FANG HAL BKR  EQT APA TRGP
            LNG EXE TPL SHEL BP TTE EQNR PBR E ENB SU CNQ CVE TRP IMO YPF WDS EC CNX AR RRC""",
    },
    {
        "id": "utilities",
        "name": "Utilities",
        "index": "XLU",
        "news_query": "utility stocks power grid",
        "symbols": """NEE SO DUK CEG AEP SRE D EXC XEL PEG ED EIX WEC ES AWK DTE ETR PPL FE AEE CMS CNP
            NI LNT EVRG ATO PNW NRG VST AES PCG NGG FTS BEP""",
    },
    {
        "id": "realestate",
        "name": "Real Estate",
        "index": "XLRE",
        "news_query": "REIT real estate stocks",
        "symbols": """PLD AMT EQIX WELL SPG PSA O CCI DLR VICI EXR   CBRE SBAC IRM WY ARE INVH MAA
            ESS KIM REG UDR CPT HST BXP FRT DOC VTR CSGP ELS SUI AMH""",
    },
    {
        "id": "materials",
        "name": "Materials",
        "index": "XLB",
        "news_query": "materials mining chemicals stocks",
        "symbols": """LIN SHW APD ECL FCX NEM DD DOW PPG NUE VMC MLM CTVA IFF ALB LYB BALL AMCR PKG IP SW
            STLD CF MOS CE EMN AVY BHP RIO VALE SCCO B AEM WPM CRH MT TECK""",
    },
]
