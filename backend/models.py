from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Text,
)

from database import Base


class CitizenRequest(Base):
    __tablename__ = "citizen_request"

    id = Column(Integer, primary_key=True, autoincrement=True)
    raw_text = Column(Text)
    language_detected = Column(Text)
    issue_category = Column(Text)
    severity = Column(Text)
    location_raw = Column(Text)
    district = Column(Text)
    block = Column(Text)
    village = Column(Text)
    latitude = Column(Float)
    longitude = Column(Float)
    confidence = Column(Float)
    is_synthetic = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # Set by P3's clustering pass (build plan P3 Step 3). NULL means the
    # report has not been clustered, or DBSCAN judged it noise -- a lone
    # report with nothing corroborating it.
    cluster_id = Column(Integer, ForeignKey("demand_cluster.id"), nullable=True)


class CitizenRequestRaw(Base):
    __tablename__ = "citizen_request_raw"

    id = Column(Integer, primary_key=True, autoincrement=True)
    original_text = Column(Text)
    linked_request_id = Column(Integer, ForeignKey("citizen_request.id"))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Gazetteer(Base):
    __tablename__ = "gazetteer"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text)
    admin_level = Column(Text)
    district = Column(Text)
    block = Column(Text)
    population = Column(Integer)
    latitude = Column(Float)
    longitude = Column(Float)


class VillageAmenities(Base):
    """
    Real per-village infrastructure, connectivity and deprivation facts, from
    the Census 2011 District Census Handbook (Village Amenities schedule).

    This table is what lets the Priority Engine stop inferring infrastructure
    condition from what a citizen *said* and start reading what the government
    itself recorded. See REAL_DATA_RESEARCH.md §2.3.

    Status columns follow the Census encoding, normalised on load:
        1 -> available, 2 -> not available, "NA"/blank -> NULL (unknown).
    NULL genuinely means "not recorded", and must never be treated as 0 --
    absence of data is not absence of the facility (research report §16.1).

    CURRENCY WARNING: this is 2011 data. A facility built since then still
    reads as absent. Cross-check road fields against the PMGSY 2022 network
    (pmgsy_road_category) before asserting a road does not exist.

    Deliberately NOT loaded: the Scheduled Caste / Scheduled Tribe population
    columns present in the same source. Excluded by explicit decision -- the
    vulnerability term is built from facility deprivation and isolation only.
    """

    __tablename__ = "village_amenities"

    id = Column(Integer, primary_key=True, autoincrement=True)
    gazetteer_id = Column(Integer, ForeignKey("gazetteer.id"), unique=True)

    # provenance of the fuzzy name match back to the census row
    census_village_name = Column(Text)
    match_score = Column(Float)

    households = Column(Integer)

    # --- road (feeds infra_deficit for category "road") ---
    road_black_topped = Column(Integer)
    road_all_weather = Column(Integer)
    road_gravel = Column(Integer)
    road_national_highway = Column(Integer)
    road_state_highway = Column(Integer)
    # from the PMGSY 2022 network, not the census -- the freshness cross-check
    pmgsy_road_category = Column(Text)

    # --- water (feeds infra_deficit for category "water") ---
    water_tap_treated = Column(Integer)
    water_tap_treated_all_year = Column(Integer)
    water_tap_treated_summer = Column(Integer)
    water_tap_untreated = Column(Integer)
    water_handpump = Column(Integer)
    water_well_covered = Column(Integer)

    # Jal Jeevan Mission, live from the JJM Citizen Corner -- CURRENT data,
    # unlike everything above it in this block, which is Census 2011 and so
    # predates JJM (launched 2019) entirely.
    # jjm_tap_coverage_pct is the metric JJM's own 55-lpcd Functional
    # Household Tap Connection norm is assessed against.
    jjm_households = Column(Integer)
    jjm_households_with_tap = Column(Integer)
    jjm_tap_coverage_pct = Column(Float)
    jjm_habitation_count = Column(Integer)
    jjm_quality_status = Column(Text)

    # --- health (feeds infra_deficit for category "health", tested vs IPHS) ---
    health_phc_count = Column(Integer)
    health_chc_count = Column(Integer)
    health_subcentre_count = Column(Integer)
    health_doctors_sanctioned = Column(Integer)
    health_doctors_in_position = Column(Integer)

    # --- education (feeds infra_deficit for "education", tested vs RTE Act) ---
    school_primary = Column(Integer)
    school_middle = Column(Integer)
    school_secondary = Column(Integer)
    # census distance band to the nearest facility when absent in-village:
    # "a" = <5km, "b" = 5-10km, "c" = >10km
    school_primary_nearest_band = Column(Text)
    health_nearest_band = Column(Text)

    # --- connectivity (feeds equity / reporting capacity) ---
    # Census 2011 fields. Measured after loading: mobile coverage is almost
    # flat in these two districts (9 of 942 villages lack it), so it carries
    # almost no ranking information and must not be leaned on. Kept for
    # corroboration only.
    conn_mobile_coverage = Column(Integer)
    conn_internet_csc = Column(Integer)
    conn_telephone = Column(Integer)
    conn_bus_public = Column(Integer)

    # BharatNet / BBNL 2022 -- 11 years fresher than the Census, and the
    # signal the equity term should actually lead on. Nearest gram-panchayat
    # fibre node to this village: "UP", "DOWN", or an unknown-status marker.
    # NOTE: this is fibre to the GP office (institutional connectivity), not
    # household mobile coverage. Real and current, but measuring a slightly
    # different thing -- say so wherever it surfaces.
    conn_bharatnet_status = Column(Text)
    conn_bharatnet_gp = Column(Text)
    conn_bharatnet_distance_km = Column(Float)

    # --- isolation and deprivation (feeds vulnerability) ---
    dist_subdistrict_hq_km = Column(Float)
    dist_district_hq_km = Column(Float)
    dist_nearest_town_km = Column(Float)
    power_domestic_summer_hrs = Column(Float)
    power_domestic_winter_hrs = Column(Float)
    drainage_none = Column(Integer)

    source = Column(Text, default="census_2011")


class GovernmentProject(Base):
    """
    A real, individually-sanctioned government work.

    This is the research report's GOVERNMENT_PROJECT entity (§15.1), which had
    no implementation at all until now -- and without it the report's whole
    "Capability E" (citizen demand scored against government investment data,
    §9) cannot exist, because there was nothing to score demand *against*.

    Source: PMGSY's live public dashboard API, per-district, no login
    (REAL_DATA_RESEARCH.md §2.2b). Each row is one road work with its
    sanction date, sanctioned cost, tender/agreement state and current
    execution status.

    IMPORTANT -- what work_status does and does not mean. The endpoint returns
    only works still in the tender/execution pipeline; no row ever carries
    "Completed". So this table is the *backlog*, not the full programme, and
    its row count must never be compared against, or added to, the district
    aggregate's Balance figure -- the two count different universes
    (REAL_DATA_RESEARCH.md §5.3). Phrase findings as "recorded in PMGSY's
    tender/execution pipeline", never as a certified "undelivered" total.
    """

    __tablename__ = "government_project"

    id = Column(Integer, primary_key=True, autoincrement=True)

    source = Column(Text, default="pmgsy_dashboard")
    external_id = Column(Integer)          # IMS_PR_ROAD_CODE
    package_id = Column(Text)              # IMS_PACKAGE_ID
    scheme_name = Column(Text)             # PMGSY I/II/III/IV, PM-JANMAN
    work_name = Column(Text)               # IMS_ROAD_NAME
    road_from = Column(Text)
    road_to = Column(Text)

    district = Column(Text)
    sanctioned_year = Column(Integer)
    sanctioned_cost_lakh = Column(Float)
    length_km = Column(Float)

    agreement_number = Column(Text)
    agreement_amount_lakh = Column(Float)
    days_sanction_to_agreement = Column(Integer)

    # "Not Started" / "In Progress" / "Agreement Cancelled"
    work_status = Column(Text)

    # Where we managed to pin this work to a place we know about. Nullable on
    # purpose: an unmatched work is still a real sanctioned work, and dropping
    # it would understate the backlog.
    matched_gazetteer_id = Column(Integer, ForeignKey("gazetteer.id"), nullable=True)
    match_score = Column(Float)
    match_field = Column(Text)             # which of road_from/road_to matched


class DemandCluster(Base):
    __tablename__ = "demand_cluster"

    id = Column(Integer, primary_key=True, autoincrement=True)
    issue_category = Column(Text)
    centroid_lat = Column(Float)
    centroid_lon = Column(Float)
    report_count = Column(Integer)
    unique_reporters = Column(Integer)
    population_affected = Column(Integer)
    # Added for P3: district drives what-if re-ranking (which district got the
    # budget), block drives the equity lookup (is this a low-connectivity
    # block). Both are the modal value across the cluster's reports.
    district = Column(Text)
    block = Column(Text)
    avg_confidence = Column(Float)
    settlement_count = Column(Integer)


class PriorityScore(Base):
    __tablename__ = "priority_score"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cluster_id = Column(Integer, ForeignKey("demand_cluster.id"))
    priority_score = Column(Float)
    breakdown = Column(Text)
    runner_up_cluster_id = Column(Integer, nullable=True)
    computed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
