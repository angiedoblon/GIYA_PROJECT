// src/screens/AdminDashboard.tsx

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

import {
  getAccessLogs,
  checkAlprGateway,
  getAlprApiUrl,
  type AccessLog,
} from "@/lib/alprApi";

import type {
  Vehicle,
  Violation,
  Profile,
  ParkingArea,
  ParkingAreaWithStats,
  ParkingSlot,
  RegistrationStatus,
  VehicleType,
} from "@/types";

import {
  VEHICLE_TYPES,
  VIOLATION_TYPES,
  getViolationLabel,
  getViolationSeverity,
} from "@/lib/constants";

import {
  Users,
  Car,
  AlertTriangle,
  Plus,
  X,
  Search,
  Shield,
  ShieldOff,
  Bus,
  Building2,
  Trash2,
  BadgeCheck,
  TrendingUp,
  ParkingSquare,
  ChevronDown,
  ChevronUp,
  User,
  Camera,
  Video,
  VideoOff,
  Clock,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";

type AdminView =
  | "overview"
  | "parking"
  | "vehicles"
  | "violations"
  | "users"
  | "cameras";

export function AdminDashboard() {
  const { signOut } = useAuth();

  const [view, setView] = useState<AdminView>("overview");

  const [areas, setAreas] = useState<ParkingAreaWithStats[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const [loading, setLoading] = useState(true);

  /*
   * ================================
   * ALPR STATE
   * ================================
   */

  const [alprLogs, setAlprLogs] = useState<AccessLog[]>([]);
  const [alprOnline, setAlprOnline] = useState(false);
  const [alprLoading, setAlprLoading] = useState(true);
  const [alprLastUpdated, setAlprLastUpdated] = useState<Date | null>(null);

  /*
   * ================================
   * LOAD SUPABASE DATA
   * ================================
   *
   * IMPORTANT:
   * This function is defined directly
   * inside the component.
   *
   * There is NO hook inside this function.
   */

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const [
        areaRes,
        slotRes,
        vehRes,
        vioRes,
        profRes,
      ] = await Promise.all([
        supabase
          .from("parking_areas")
          .select("*")
          .eq("is_active", true)
          .order("code"),

        supabase
          .from("parking_slots")
          .select("area_id, status"),

        supabase
          .from("vehicles")
          .select("*")
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("violations")
          .select("*")
          .order("created_at", {
            ascending: false,
          })
          .limit(100),

        supabase
          .from("profiles")
          .select("*")
          .order("created_at", {
            ascending: false,
          }),
      ]);

      if (areaRes.error) {
        console.error(
          "[Dashboard] Parking areas error:",
          areaRes.error
        );
      }

      if (slotRes.error) {
        console.error(
          "[Dashboard] Parking slots error:",
          slotRes.error
        );
      }

      if (vehRes.error) {
        console.error(
          "[Dashboard] Vehicles error:",
          vehRes.error
        );
      }

      if (vioRes.error) {
        console.error(
          "[Dashboard] Violations error:",
          vioRes.error
        );
      }

      if (profRes.error) {
        console.error(
          "[Dashboard] Profiles error:",
          profRes.error
        );
      }

      const slotMap = new Map<
        string,
        {
          available: number;
          occupied: number;
        }
      >();

      const slots =
        (slotRes.data as
          | {
              area_id: string;
              status: string;
            }[]
          | null) ?? [];

      for (const slot of slots) {
        const current =
          slotMap.get(slot.area_id) ?? {
            available: 0,
            occupied: 0,
          };

        if (slot.status === "available") {
          current.available += 1;
        } else {
          current.occupied += 1;
        }

        slotMap.set(slot.area_id, current);
      }

      const parkingAreas =
        (areaRes.data as ParkingArea[] | null) ?? [];

      const enrichedAreas =
        parkingAreas.map((area) => {
          const stats =
            slotMap.get(area.id) ?? {
              available: 0,
              occupied: 0,
            };

          return {
            ...area,
            available_slots: stats.available,
            occupied_slots: stats.occupied,
          };
        });

      setAreas(enrichedAreas);

      setVehicles(
        (vehRes.data as Vehicle[] | null) ?? []
      );

      setViolations(
        (vioRes.data as Violation[] | null) ?? []
      );

      setProfiles(
        (profRes.data as Profile[] | null) ?? []
      );
    } catch (error) {
      console.error(
        "[Dashboard] Failed to load dashboard data:",
        error
      );
    } finally {
      setLoading(false);
    }
  }, []);

  /*
   * ================================
   * LOAD ALPR DATA
   * ================================
   *
   * This is OUTSIDE loadData().
   *
   * This is very important because
   * React hooks must never be nested
   * inside another function.
   */

  const loadAlprData = useCallback(async () => {
    try {
      setAlprLoading(true);

      const logs = await getAccessLogs();

      setAlprLogs(logs);
      setAlprOnline(true);
      setAlprLastUpdated(new Date());
    } catch (error) {
      console.error(
        "[Dashboard] ALPR connection failed:",
        error
      );

      setAlprOnline(false);
    } finally {
      setAlprLoading(false);
    }
  }, []);

  /*
   * ================================
   * INITIAL LOAD
   * ================================
   */

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /*
   * Refresh Supabase data every 30 seconds.
   */

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadData();
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadData]);

  /*
   * ================================
   * INITIAL ALPR LOAD
   * ================================
   */

  useEffect(() => {
    void loadAlprData();

    /*
     * Refresh ALPR every 5 seconds.
     */
    const interval = window.setInterval(() => {
      void loadAlprData();
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadAlprData]);

  /*
   * ================================
   * CALCULATED DATA
   * ================================
   */

  const totalAvailable = areas.reduce(
    (sum, area) =>
      sum + Number(area.available_slots ?? 0),
    0
  );

  const totalSlots = areas.reduce(
    (sum, area) =>
      sum + Number(area.total_slots ?? 0),
    0
  );

  const totalOccupied = Math.max(
    0,
    totalSlots - totalAvailable
  );

  const activeViolations = violations.filter(
    (violation) => violation.status === "active"
  );

  /*
   * ================================
   * RENDER
   * ================================
   */

  return (
    <div className="min-h-screen w-full bg-gray-50">

      {/* HEADER */}
  {/* HEADER */}
<header className="sticky top-0 z-30 bg-gray-900 text-white px-5 py-3.5">
  <div className="flex items-center justify-between">

    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center overflow-hidden shadow">
        <img
          src="/giyalogo.png"
          alt="ESSU Logo"
          className="w-full h-full object-cover"
        />
      </div>

      <div>
        <h1 className="text-sm font-extrabold leading-tight">
          ESSU Admin
        </h1>

        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
          Parking Control Panel
        </p>
      </div>
    </div>

    <div className="flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />

      <span className="text-xs font-semibold text-primary-400">
        Live
      </span>
    </div>
  </div>
</header>

      <div className="px-5 py-4 pb-28 space-y-5">

        {/* NAVIGATION */}
        <div className="flex bg-gray-100 rounded-xl p-1 overflow-x-auto">

          {(
            [
              {
                key: "overview",
                label: "Overview",
              },
              {
                key: "parking",
                label: "Parking",
              },
              {
                key: "vehicles",
                label: "Vehicles",
              },
              {
                key: "violations",
                label: "Violations",
              },
              {
                key: "users",
                label: "Users",
              },
              {
                key: "cameras",
                label: "Cameras",
              },
            ] as {
              key: AdminView;
              label: string;
            }[]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`flex-1 min-w-fit px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                view === tab.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {view === "overview" && (
          <OverviewView
            areas={areas}
            vehicles={vehicles}
            violations={violations}
            profiles={profiles}
            totalAvailable={totalAvailable}
            totalSlots={totalSlots}
            totalOccupied={totalOccupied}
            activeViolations={activeViolations.length}
            loading={loading}
            onSelectArea={() =>
              setView("parking")
            }
            alprLogs={alprLogs}
            alprOnline={alprOnline}
            alprLoading={alprLoading}
            alprLastUpdated={alprLastUpdated}
            onRefreshAlpr={loadAlprData}
          />
        )}

        {/* PARKING */}
        {view === "parking" && (
          <ParkingManagement
            areas={areas}
            onRefresh={loadData}
          />
        )}

        {/* VEHICLES */}
        {view === "vehicles" && (
          <VehiclesManagement
            vehicles={vehicles}
            profiles={profiles}
            onRefresh={loadData}
          />
        )}

        {/* VIOLATIONS */}
        {view === "violations" && (
          <ViolationsManagement
            violations={violations}
            vehicles={vehicles}
            areas={areas}
            onRefresh={loadData}
          />
        )}

        {/* USERS */}
        {view === "users" && (
          <UsersManagement
            profiles={profiles}
            vehicles={vehicles}
            violations={violations}
          />
        )}

        {/* CAMERAS */}
        {view === "cameras" && (
          <CamerasView areas={areas} />
        )}

        {/* SIGN OUT */}
        <button
          onClick={() => {
            void signOut();
          }}
          className="w-full bg-gray-200 text-gray-600 font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2 hover:bg-gray-300 transition-colors"
        >
          <ShieldOff size={17} />
          Sign Out
        </button>

      </div>
    </div>
  );
}

/* ============================================================
   OVERVIEW
============================================================ */

function OverviewView({
  areas,
  vehicles,
  violations,
  profiles,
  totalAvailable,
  totalSlots,
  totalOccupied,
  activeViolations,
  loading,
  onSelectArea,
  alprLogs,
  alprOnline,
  alprLoading,
  alprLastUpdated,
  onRefreshAlpr,
}: {
  areas: ParkingAreaWithStats[];
  vehicles: Vehicle[];
  violations: Violation[];
  profiles: Profile[];
  totalAvailable: number;
  totalSlots: number;
  totalOccupied: number;
  activeViolations: number;
  loading: boolean;
  onSelectArea: () => void;

  alprLogs: AccessLog[];
  alprOnline: boolean;
  alprLoading: boolean;
  alprLastUpdated: Date | null;
  onRefreshAlpr: () => void;
}) {
  const occupancyRate =
    totalSlots > 0
      ? Math.min(
          100,
          Math.round(
            (totalOccupied / totalSlots) * 100
          )
        )
      : 0;

  const fullAreas = areas.filter(
    (area) => area.available_slots === 0
  ).length;

  return (
    <div className="space-y-4 animate-fade-in">

      {/* =====================================================
          ALPR SYSTEM
      ===================================================== */}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

        {/* ALPR HEADER */}
        <div className="px-4 py-4 border-b border-gray-100">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-3">

              <div className="w-10 h-10 rounded-xl bg-gray-900 text-white flex items-center justify-center">
                <Camera size={20} />
              </div>

              <div>
                <h3 className="text-sm font-extrabold text-gray-900">
                  ALPR System
                </h3>

                <p className="text-[10px] text-gray-500">
                  Raspberry Pi License Plate Recognition
                </p>
              </div>

            </div>

            <div className="flex items-center gap-2">

              {alprOnline ? (
                <>
                  <Wifi
                    size={15}
                    className="text-primary-600"
                  />

                  <span className="text-xs font-bold text-primary-600">
                    Online
                  </span>
                </>
              ) : (
                <>
                  <WifiOff
                    size={15}
                    className="text-error-500"
                  />

                  <span className="text-xs font-bold text-error-600">
                    Offline
                  </span>
                </>
              )}

            </div>

          </div>
        </div>

        {/* ALPR BODY */}
        <div className="p-4">

          {/* API URL */}
          <div className="bg-gray-50 rounded-xl p-3 mb-3">

            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
              Gateway
            </p>

            <p className="text-xs font-mono text-gray-700 mt-1 break-all">
              {getAlprApiUrl()}
            </p>

          </div>

          {/* STATUS */}
          <div className="flex items-center justify-between mb-3">

            <div className="flex items-center gap-2">

              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  alprOnline
                    ? "bg-primary-500 animate-pulse"
                    : "bg-red-500"
                }`}
              />

              <span className="text-xs font-semibold text-gray-700">
                {alprLoading
                  ? "Checking ALPR..."
                  : alprOnline
                    ? "Raspberry Pi connected"
                    : "Raspberry Pi unavailable"}
              </span>

            </div>

            <button
              onClick={onRefreshAlpr}
              disabled={alprLoading}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              title="Refresh ALPR"
            >
              <RefreshCw
                size={15}
                className={
                  alprLoading
                    ? "animate-spin text-gray-400"
                    : "text-gray-500"
                }
              />
            </button>

          </div>

          {/* LAST UPDATED */}
          {alprLastUpdated && (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-3">
              <Clock size={12} />
              Last updated{" "}
              {alprLastUpdated.toLocaleTimeString()}
            </div>
          )}

          {/* LOGS */}
          {alprLoading && alprLogs.length === 0 ? (
            <div className="space-y-2">

              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-14 rounded-xl bg-gray-100 animate-pulse"
                />
              ))}

            </div>
          ) : !alprOnline ? (
            <div className="rounded-xl border border-error-200 bg-error-50 p-4 text-center">

              <WifiOff
                size={25}
                className="text-error-500 mx-auto mb-2"
              />

              <p className="text-sm font-semibold text-error-700">
                ALPR gateway is offline
              </p>

              <p className="text-xs text-error-600 mt-1">
                Check the Raspberry Pi and network connection.
              </p>

            </div>
          ) : alprLogs.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 text-center">

              <Camera
                size={25}
                className="text-gray-400 mx-auto mb-2"
              />

              <p className="text-sm font-semibold text-gray-600">
                No ALPR records yet
              </p>

              <p className="text-xs text-gray-400 mt-1">
                The Raspberry Pi is connected, but no access
                records have been returned.
              </p>

            </div>
          ) : (
            <div className="space-y-2">

              {alprLogs.slice(0, 5).map(
                (log, index) => (
                  <AlprLogCard
                    key={
                      log.id ??
                      `${log.plate_number ?? log.plate ?? "log"}-${index}`
                    }
                    log={log}
                  />
                )
              )}

            </div>
          )}

          {/* TOTAL RECORDS */}
          {alprOnline && alprLogs.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">

              <p className="text-[10px] text-gray-400">
                Showing {Math.min(5, alprLogs.length)} of{" "}
                {alprLogs.length} returned ALPR records
              </p>

            </div>
          )}

        </div>
      </div>

      {/* =====================================================
          OCCUPANCY
      ===================================================== */}

      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-5 text-white shadow-lg">

        <div className="flex items-center justify-between mb-3">

          <div>
            <p className="text-gray-400 text-xs font-medium uppercase tracking-wide">
              Campus Occupancy
            </p>

            <p className="text-3xl font-extrabold mt-0.5">
              {occupancyRate}
              <span className="text-lg text-gray-400">
                %
              </span>
            </p>
          </div>

          <div className="flex items-center justify-center w-14 h-14 bg-white/10 rounded-2xl">
            <TrendingUp
              size={28}
              className="text-primary-400"
            />
          </div>

        </div>

        <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden">

          <div
            className="bg-primary-500 h-full transition-all duration-500"
            style={{
              width: `${occupancyRate}%`,
            }}
          />

        </div>

        <div className="flex items-center gap-4 mt-3 text-sm">

          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-400" />
            <span className="text-gray-300">
              {totalAvailable} free
            </span>
          </span>

          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="text-gray-300">
              {totalOccupied} taken
            </span>
          </span>

        </div>

      </div>

      {/* =====================================================
          QUICK STATS
      ===================================================== */}

      {loading ? (
        <div className="grid grid-cols-2 gap-3">

          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="card p-4 animate-pulse"
            >
              <div className="h-20 bg-gray-100 rounded-xl" />
            </div>
          ))}

        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">

          <StatCard
            icon={ParkingSquare}
            label="Parking Areas"
            value={areas.length}
            sub={`${fullAreas} full`}
            color="primary"
          />

          <StatCard
            icon={Users}
            label="Registered Users"
            value={profiles.length}
            sub={`${profiles.filter(
              (p) => p.role === "admin"
            ).length} admin`}
            color="accent"
          />

          <StatCard
            icon={Car}
            label="Vehicles"
            value={vehicles.length}
            sub={`${vehicles.filter(
              (v) =>
                v.registration_status ===
                "unregistered"
            ).length} unreg`}
            color="warning"
          />

          <StatCard
            icon={AlertTriangle}
            label="Active Violations"
            value={activeViolations}
            sub={`${violations.length} total`}
            color="error"
          />

        </div>
      )}

      {/* =====================================================
          PARKING AREA STATUS
      ===================================================== */}

      <div>

        <div className="flex items-center justify-between mb-3">

          <h3 className="section-title text-base">
            Parking Area Status
          </h3>

          <button
            onClick={onSelectArea}
            className="text-xs font-semibold text-primary-600"
          >
            Manage all
          </button>

        </div>

        {areas.length === 0 ? (
          <div className="card p-6 text-center">
            <ParkingSquare
              size={30}
              className="text-gray-300 mx-auto mb-2"
            />

            <p className="text-sm text-gray-500">
              No parking areas found
            </p>
          </div>
        ) : (
          <div className="space-y-2">

            {areas.map((area) => {

              const isFull =
                area.available_slots === 0;

              const isLow =
                area.available_slots > 0 &&
                area.available_slots <=
                  Math.ceil(
                    area.total_slots * 0.15
                  );

              return (
                <button
                  key={area.id}
                  onClick={onSelectArea}
                  className="card p-3.5 w-full flex items-center justify-between transition-all active:scale-[0.99] hover:shadow-md text-left"
                >

                  <div className="flex items-center gap-3">

                    <div className="flex items-center justify-center w-9 h-9 bg-gray-100 rounded-lg">
                      <span className="text-gray-700 font-bold text-xs">
                        {area.code}
                      </span>
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {area.name}
                      </p>

                      <p className="text-xs text-gray-500">
                        {area.department}
                      </p>
                    </div>

                  </div>

                  <div className="text-right">

                    <p
                      className={`text-sm font-bold ${
                        isFull
                          ? "text-error-600"
                          : isLow
                            ? "text-warning-600"
                            : "text-primary-600"
                      }`}
                    >
                      {area.available_slots}/
                      {area.total_slots}
                    </p>

                    <p className="text-[10px] text-gray-400">
                      {isFull
                        ? "Full"
                        : "available"}
                    </p>

                  </div>

                </button>
              );
            })}

          </div>
        )}

      </div>

    </div>
  );
}

/* ============================================================
   ALPR LOG CARD
============================================================ */

function AlprLogCard({
  log,
}: {
  log: AccessLog;
}) {
  const plate =
    log.plate_number ??
    log.plate ??
    log.vehicle_plate ??
    "Unknown plate";

  const status =
    log.status ??
    log.decision ??
    log.event ??
    "Detected";

  const timeValue =
    log.timestamp ??
    log.created_at;

  let displayTime = "Unknown time";

  if (timeValue) {
    const date = new Date(timeValue);

    if (!Number.isNaN(date.getTime())) {
      displayTime =
        date.toLocaleDateString() +
        " " +
        date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
    }
  }

  const normalizedStatus =
    String(status).toLowerCase();

  const isAllowed =
    normalizedStatus.includes("allow") ||
    normalizedStatus.includes("granted") ||
    normalizedStatus.includes("authorized") ||
    normalizedStatus.includes("registered");

  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-3">

      <div className="flex items-center gap-3">

        <div className="w-9 h-9 rounded-lg bg-gray-900 text-white flex items-center justify-center">
          <Camera size={16} />
        </div>

        <div>

          <p className="font-mono font-bold text-sm text-gray-900">
            {String(plate)}
          </p>

          <p className="text-[10px] text-gray-400">
            {displayTime}
          </p>

        </div>

      </div>

      <span
        className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
          isAllowed
            ? "bg-primary-100 text-primary-700"
            : "bg-gray-200 text-gray-600"
        }`}
      >
        {String(status)}
      </span>

    </div>
  );
}

/* ============================================================
   STAT CARD
============================================================ */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  sub: string;
  color:
    | "primary"
    | "accent"
    | "warning"
    | "error";
}) {
  const colors = {
    primary:
      "bg-primary-50 text-primary-600",
    accent:
      "bg-accent-50 text-accent-600",
    warning:
      "bg-warning-50 text-warning-600",
    error:
      "bg-error-50 text-error-600",
  };

  return (
    <div className="card p-4">

      <div className="flex items-center gap-2 mb-2">

        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors[color]}`}
        >
          <Icon size={18} />
        </div>

        <span className="text-xs font-semibold text-gray-500">
          {label}
        </span>

      </div>

      <div className="text-2xl font-extrabold text-gray-900">
        {value}
      </div>

      <div className="text-xs text-gray-400 mt-0.5">
        {sub}
      </div>

    </div>
  );
}

/* ============================================================
   PARKING MANAGEMENT
============================================================ */

function ParkingManagement({
  areas,
  onRefresh,
}: {
  areas: ParkingAreaWithStats[];
  onRefresh: () => void;
}) {
  const [expandedArea, setExpandedArea] =
    useState<string | null>(null);

  const [slots, setSlots] =
    useState<ParkingSlot[]>([]);

  const [loadingSlots, setLoadingSlots] =
    useState(false);

  async function loadSlots(areaId: string) {
    setLoadingSlots(true);

    try {
      const { data, error } =
        await supabase
          .from("parking_slots")
          .select("*")
          .eq("area_id", areaId)
          .order("slot_number");

      if (error) {
        console.error(
          "[Parking] Failed to load slots:",
          error
        );

        setSlots([]);
        return;
      }

      setSlots(
        (data as ParkingSlot[] | null) ?? []
      );
    } finally {
      setLoadingSlots(false);
    }
  }

  async function toggleSlot(
    slot: ParkingSlot
  ) {
    const newStatus =
      slot.status === "available"
        ? "occupied"
        : "available";

    const { error } =
      await supabase
        .from("parking_slots")
        .update({
          status: newStatus,
        })
        .eq("id", slot.id);

    if (error) {
      console.error(
        "[Parking] Failed to update slot:",
        error
      );

      return;
    }

    setSlots((previous) =>
      previous.map((item) =>
        item.id === slot.id
          ? {
              ...item,
              status: newStatus,
            }
          : item
      )
    );

    onRefresh();
  }

  return (
    <div className="space-y-3 animate-fade-in">

      <div>
        <h3 className="section-title text-base">
          Manage Parking Slots
        </h3>

        <p className="text-sm text-gray-500 mt-1">
          Tap an area to view and manage
          individual slots.
        </p>
      </div>

      {areas.map((area) => {

        const isExpanded =
          expandedArea === area.id;

        return (
          <div
            key={area.id}
            className="card overflow-hidden"
          >

            <button
              onClick={() => {
                if (isExpanded) {
                  setExpandedArea(null);
                } else {
                  setExpandedArea(area.id);
                  void loadSlots(area.id);
                }
              }}
              className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >

              <div className="flex items-center gap-3">

                <div className="flex items-center justify-center w-10 h-10 bg-primary-50 rounded-xl">
                  <span className="text-primary-700 font-bold text-sm">
                    {area.code}
                  </span>
                </div>

                <div className="text-left">

                  <p className="font-semibold text-gray-900 text-sm">
                    {area.name}
                  </p>

                  <p className="text-xs text-gray-500">
                    {area.available_slots}/
                    {area.total_slots} available
                  </p>

                </div>

              </div>

              {isExpanded ? (
                <ChevronUp
                  size={18}
                  className="text-gray-400"
                />
              ) : (
                <ChevronDown
                  size={18}
                  className="text-gray-400"
                />
              )}

            </button>

            {isExpanded && (
              <div className="border-t border-gray-100 p-4">

                {loadingSlots ? (
                  <div className="grid grid-cols-8 gap-2">

                    {Array.from({
                      length: 20,
                    }).map((_, index) => (
                      <div
                        key={index}
                        className="aspect-square bg-gray-100 rounded-lg animate-pulse"
                      />
                    ))}

                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    No parking slots found.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-3 text-xs">

                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-primary-500" />
                        Available
                      </span>

                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-error-400" />
                        Occupied
                      </span>

                    </div>

                    <div className="grid grid-cols-8 gap-2">

                      {slots.map((slot) => (
                        <button
                          key={slot.id}
                          onClick={() =>
                            void toggleSlot(slot)
                          }
                          className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold ${
                            slot.status ===
                            "available"
                              ? "bg-primary-100 text-primary-700 border border-primary-200"
                              : "bg-error-100 text-error-600 border border-error-200"
                          }`}
                        >
                          {slot.slot_number}
                        </button>
                      ))}

                    </div>
                  </>
                )}

              </div>
            )}

          </div>
        );
      })}

    </div>
  );
}

/* ============================================================
   VIOLATIONS MANAGEMENT
============================================================ */

function ViolationsManagement({
  violations,
  vehicles,
  areas,
  onRefresh,
}: {
  violations: Violation[];
  vehicles: Vehicle[];
  areas: ParkingAreaWithStats[];
  onRefresh: () => void;
}) {
  const [showIssue, setShowIssue] =
    useState(false);

  return (
    <div className="space-y-4 animate-fade-in">

      <div className="flex items-center justify-between">

        <h3 className="section-title text-base">
          Violation Records
        </h3>

        <button
          onClick={() => setShowIssue(true)}
          className="btn-secondary text-sm py-2 px-4 flex items-center gap-1.5"
        >
          <Plus size={16} />
          Issue
        </button>

      </div>

      {violations.length === 0 ? (
        <div className="card p-8 text-center">

          <Shield
            size={36}
            className="text-primary-300 mx-auto mb-3"
          />

          <p className="text-sm text-gray-500">
            No violations recorded
          </p>

        </div>
      ) : (
        <div className="space-y-3">

          {violations.map((violation) => {

            const severity =
              getViolationSeverity(
                violation.violation_count
              );

            const styles = {
              error:
                "bg-error-50 border-error-200",
              warning:
                "bg-warning-50 border-warning-200",
              info:
                "bg-accent-50 border-accent-200",
            }[severity];

            const iconColor = {
              error: "text-error-600",
              warning: "text-warning-600",
              info: "text-accent-600",
            }[severity];

            return (
              <div
                key={violation.id}
                className={`card p-4 border-l-4 ${styles}`}
              >

                <div className="flex items-start justify-between mb-2">

                  <div className="flex items-center gap-2">

                    <AlertTriangle
                      size={18}
                      className={iconColor}
                    />

                    <span className="font-bold text-gray-900 text-sm">
                      {violation.violation_type}
                    </span>

                  </div>

                  <span
                    className={`badge ${
                      violation.status ===
                      "warning"
                        ? "bg-warning-100 text-warning-700"
                        : "bg-error-100 text-error-700"
                    }`}
                  >
                    {getViolationLabel(
                      violation.violation_count
                    )}
                  </span>

                </div>

                <div className="flex items-center gap-3 text-xs text-gray-500 ml-7">

                  <span className="font-mono font-semibold">
                    {violation.plate_number}
                  </span>

                  <span>·</span>

                  <span>
                    {violation.area_name ??
                      "Unknown"}
                  </span>

                </div>

                {violation.description && (
                  <p className="text-xs text-gray-500 ml-7 mt-1.5">
                    {violation.description}
                  </p>
                )}

                <p className="text-[10px] text-gray-400 mt-2 ml-7">
                  {new Date(
                    violation.created_at
                  ).toLocaleDateString()}
                </p>

              </div>
            );
          })}

        </div>
      )}

      {showIssue && (
        <IssueViolationModal
          vehicles={vehicles}
          areas={areas}
          onClose={() =>
            setShowIssue(false)
          }
          onIssued={() => {
            setShowIssue(false);
            onRefresh();
          }}
        />
      )}

    </div>
  );
}

/* ============================================================
   ISSUE VIOLATION MODAL
============================================================ */

function IssueViolationModal({
  vehicles,
  areas,
  onClose,
  onIssued,
}: {
  vehicles: Vehicle[];
  areas: ParkingAreaWithStats[];
  onClose: () => void;
  onIssued: () => void;
}) {
  const { user } = useAuth();

  const [plate, setPlate] = useState("");
  const [areaId, setAreaId] =
    useState("");

  const [violationType, setViolationType] =
    useState(VIOLATION_TYPES[0]);

  const [description, setDescription] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  async function handleIssue() {
    if (!plate.trim() || !areaId) {
      setError(
        "Plate number and parking area are required."
      );
      return;
    }

    if (!user) {
      setError(
        "You must be signed in to issue a violation."
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const normalizedPlate =
        plate.trim().toUpperCase();

      const area = areas.find(
        (item) => item.id === areaId
      );

      const matchedVehicle =
        vehicles.find(
          (vehicle) =>
            vehicle.plate_number
              .toUpperCase() ===
            normalizedPlate
        );

      const { data: existing } =
        await supabase
          .from("violations")
          .select("violation_count")
          .eq(
            "plate_number",
            normalizedPlate
          )
          .order("created_at", {
            ascending: false,
          })
          .limit(1);

      const previousCount =
        Number(
          existing?.[0]?.violation_count ?? 0
        );

      const newCount =
        previousCount + 1;

      const status =
        newCount >= 4
          ? "warning"
          : "active";

      const { error: insertError } =
        await supabase
          .from("violations")
          .insert({
            user_id:
              matchedVehicle?.user_id ??
              user.id,

            vehicle_id:
              matchedVehicle?.id ??
              null,

            plate_number:
              normalizedPlate,

            area_id: areaId,

            area_name:
              area?.name ?? null,

            violation_type:
              violationType,

            violation_count:
              newCount,

            status,

            description:
              description.trim() ||
              null,
          });

      if (insertError) {
        throw insertError;
      }

      if (matchedVehicle?.user_id) {
        await supabase
          .from("notifications")
          .insert({
            user_id:
              matchedVehicle.user_id,

            title:
              `${getViolationLabel(
                newCount
              )}: ${violationType}`,

            message:
              `Your vehicle ${normalizedPlate} received a ${getViolationLabel(
                newCount
              ).toLowerCase()} at ${
                area?.name ??
                "a parking area"
              }.`,

            type: "violation",
          });
      }

      onIssued();
    } catch (error) {
      console.error(
        "[Violations] Failed to issue:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to issue violation."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
      onClick={onClose}
    >

      <div
        className="bg-white w-full max-w-md rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto"
        onClick={(event) =>
          event.stopPropagation()
        }
      >

        <div className="flex items-center justify-between mb-5">

          <h3 className="text-lg font-bold text-gray-900">
            Issue Violation
          </h3>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <X
              size={20}
              className="text-gray-500"
            />
          </button>

        </div>

        <div className="space-y-4">

          <div>

            <label className="label">
              Plate Number *
            </label>

            <input
              type="text"
              value={plate}
              onChange={(event) =>
                setPlate(
                  event.target.value.toUpperCase()
                )
              }
              placeholder="ABC 1234"
              className="input-field font-mono font-semibold uppercase"
            />

          </div>

          <div>

            <label className="label">
              Parking Area *
            </label>

            <select
              value={areaId}
              onChange={(event) =>
                setAreaId(event.target.value)
              }
              className="input-field"
            >

              <option value="">
                Select area
              </option>

              {areas.map((area) => (
                <option
                  key={area.id}
                  value={area.id}
                >
                  {area.code} - {area.name}
                </option>
              ))}

            </select>

          </div>

          <div>

            <label className="label">
              Violation Type
            </label>

            <select
              value={violationType}
              onChange={(event) =>
                setViolationType(
                  event.target.value
                )
              }
              className="input-field"
            >

              {VIOLATION_TYPES.map(
                (type) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {type}
                  </option>
                )
              )}

            </select>

          </div>

          <div>

            <label className="label">
              Description
            </label>

            <textarea
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value
                )
              }
              rows={3}
              className="input-field resize-none"
              placeholder="Additional details..."
            />

          </div>

          {error && (
            <div className="bg-error-50 border border-error-200 text-error-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            onClick={() =>
              void handleIssue()
            }
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving
              ? "Issuing..."
              : "Issue Violation"}
          </button>

        </div>

      </div>
    </div>
  );
}

/* ============================================================
   VEHICLES MANAGEMENT
============================================================ */

function VehiclesManagement({
  vehicles,
  profiles,
  onRefresh,
}: {
  vehicles: Vehicle[];
  profiles: Profile[];
  onRefresh: () => void;
}) {
  const [search, setSearch] =
    useState("");

  const [showAdd, setShowAdd] =
    useState(false);

  const filtered =
    vehicles.filter((vehicle) => {
      const query =
        search.toLowerCase();

      return (
        !query ||
        vehicle.plate_number
          .toLowerCase()
          .includes(query) ||
        (vehicle.make ?? "")
          .toLowerCase()
          .includes(query) ||
        (vehicle.model ?? "")
          .toLowerCase()
          .includes(query)
      );
    });

  async function handleDelete(
    vehicleId: string
  ) {
    const { error } =
      await supabase
        .from("vehicles")
        .delete()
        .eq("id", vehicleId);

    if (error) {
      console.error(
        "[Vehicles] Delete failed:",
        error
      );
      return;
    }

    onRefresh();
  }

  async function toggleRegistration(
    vehicle: Vehicle
  ) {
    const newStatus: RegistrationStatus =
      vehicle.registration_status ===
      "registered"
        ? "unregistered"
        : "registered";

    const { error } =
      await supabase
        .from("vehicles")
        .update({
          registration_status:
            newStatus,
        })
        .eq("id", vehicle.id);

    if (error) {
      console.error(
        "[Vehicles] Status update failed:",
        error
      );
      return;
    }

    onRefresh();
  }

  function getOwnerName(
    userId: string
  ) {
    return (
      profiles.find(
        (profile) =>
          profile.id === userId
      )?.full_name ??
      "Unknown"
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">

      <div className="flex items-center justify-between">

        <h3 className="section-title text-base">
          All Vehicles
        </h3>

        <button
          onClick={() =>
            setShowAdd(true)
          }
          className="btn-secondary text-sm py-2 px-4 flex items-center gap-1.5"
        >
          <Plus size={16} />
          Register
        </button>

      </div>

      <div className="relative">

        <Search
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
        />

        <input
          type="text"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search plate, make, or model..."
          className="input-field pl-11"
        />

      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center">

          <Car
            size={36}
            className="text-gray-300 mx-auto mb-3"
          />

          <p className="text-sm text-gray-500">
            No vehicles found
          </p>

        </div>
      ) : (
        <div className="space-y-3">

          {filtered.map((vehicle) => (
            <AdminVehicleCard
              key={vehicle.id}
              vehicle={vehicle}
              ownerName={getOwnerName(
                vehicle.user_id
              )}
              onDelete={() =>
                void handleDelete(
                  vehicle.id
                )
              }
              onToggleRegistration={() =>
                void toggleRegistration(
                  vehicle
                )
              }
            />
          ))}

        </div>
      )}

      {showAdd && (
        <AdminAddVehicleModal
          profiles={profiles}
          onClose={() =>
            setShowAdd(false)
          }
          onAdded={() => {
            setShowAdd(false);
            onRefresh();
          }}
        />
      )}

    </div>
  );
}

/* ============================================================
   VEHICLE CARD
============================================================ */

function AdminVehicleCard({
  vehicle,
  ownerName,
  onDelete,
  onToggleRegistration,
}: {
  vehicle: Vehicle;
  ownerName: string;
  onDelete: () => void;
  onToggleRegistration: () => void;
}) {
  const [confirming, setConfirming] =
    useState(false);

  const TypeIcon =
    vehicle.type === "public"
      ? Bus
      : vehicle.type === "essu-owned"
        ? Building2
        : Car;

  const typeLabel =
    VEHICLE_TYPES.find(
      (item) =>
        item.value === vehicle.type
    )?.label ??
    vehicle.type;

  return (
    <div className="card p-4">

      <div className="flex items-start justify-between mb-3">

        <div className="flex items-center gap-3">

          <div className="w-11 h-11 bg-gray-100 rounded-xl flex items-center justify-center">
            <TypeIcon
              size={20}
              className="text-primary-600"
            />
          </div>

          <div>

            <div className="flex items-center gap-1.5">

              <span className="font-bold text-gray-900 font-mono">
                {vehicle.plate_number}
              </span>

              {vehicle.is_primary && (
                <BadgeCheck
                  size={15}
                  className="text-primary-500"
                />
              )}

            </div>

            <p className="text-xs text-gray-500">
              {[
                vehicle.make,
                vehicle.model,
                vehicle.color,
              ]
                .filter(Boolean)
                .join(" · ") ||
                "No details"}
            </p>

            <p className="text-xs text-gray-400 mt-0.5">
              Owner: {ownerName}
            </p>

          </div>

        </div>

        <div>

          {confirming ? (
            <div className="flex items-center gap-1">

              <button
                onClick={() => {
                  onDelete();
                  setConfirming(false);
                }}
                className="text-xs font-semibold text-error-600 px-2.5 py-1.5 rounded-lg"
              >
                Delete
              </button>

              <button
                onClick={() =>
                  setConfirming(false)
                }
                className="p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X
                  size={15}
                  className="text-gray-400"
                />
              </button>

            </div>
          ) : (
            <button
              onClick={() =>
                setConfirming(true)
              }
              className="p-2 rounded-lg hover:bg-error-50"
            >
              <Trash2
                size={16}
                className="text-gray-400"
              />
            </button>
          )}

        </div>

      </div>

      <div className="flex items-center gap-2 flex-wrap">

        <button
          onClick={onToggleRegistration}
          className={`badge flex items-center gap-1 ${
            vehicle.registration_status ===
            "registered"
              ? "bg-primary-100 text-primary-700"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          {vehicle.registration_status ===
          "registered" ? (
            <>
              <Shield size={12} />
              Registered
            </>
          ) : (
            <>
              <ShieldOff size={12} />
              Unregistered
            </>
          )}
        </button>

        <span className="badge bg-accent-100 text-accent-700 capitalize">
          {typeLabel}
        </span>

      </div>

    </div>
  );
}

/* ============================================================
   ADD VEHICLE MODAL
============================================================ */

function AdminAddVehicleModal({
  profiles,
  onClose,
  onAdded,
}: {
  profiles: Profile[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [userId, setUserId] =
    useState("");

  const [plate, setPlate] =
    useState("");

  const [make, setMake] =
    useState("");

  const [model, setModel] =
    useState("");

  const [color, setColor] =
    useState("");

  const [type, setType] =
    useState<VehicleType>("private");

  const [regStatus, setRegStatus] =
    useState<RegistrationStatus>(
      "registered"
    );

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const nonAdminProfiles =
    profiles.filter(
      (profile) =>
        profile.role !== "admin"
    );

  async function handleSave() {
    if (!userId) {
      setError(
        "Please select an owner."
      );
      return;
    }

    if (!plate.trim()) {
      setError(
        "Plate number is required."
      );
      return;
    }

    setSaving(true);
    setError(null);

    const { error: insertError } =
      await supabase
        .from("vehicles")
        .insert({
          user_id: userId,
          plate_number:
            plate.trim().toUpperCase(),
          make:
            make.trim() || null,
          model:
            model.trim() || null,
          color:
            color || null,
          type,
          registration_status:
            regStatus,
          is_primary: false,
        });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    onAdded();
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
      onClick={onClose}
    >

      <div
        className="bg-white w-full max-w-md rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(event) =>
          event.stopPropagation()
        }
      >

        <div className="flex items-center justify-between mb-5">

          <h3 className="text-lg font-bold text-gray-900">
            Register Vehicle
          </h3>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100"
          >
            <X
              size={20}
              className="text-gray-500"
            />
          </button>

        </div>

        <div className="space-y-4">

          <div>

            <label className="label">
              Vehicle Owner *
            </label>

            <select
              value={userId}
              onChange={(event) =>
                setUserId(event.target.value)
              }
              className="input-field"
            >

              <option value="">
                Select user
              </option>

              {nonAdminProfiles.map(
                (profile) => (
                  <option
                    key={profile.id}
                    value={profile.id}
                  >
                    {profile.full_name ??
                      profile.id}
                  </option>
                )
              )}

            </select>

          </div>

          <div>

            <label className="label">
              Plate Number *
            </label>

            <input
              type="text"
              value={plate}
              onChange={(event) =>
                setPlate(
                  event.target.value.toUpperCase()
                )
              }
              placeholder="ABC 1234"
              className="input-field font-mono font-semibold"
            />

          </div>

          <div className="grid grid-cols-2 gap-3">

            <div>
              <label className="label">
                Make
              </label>

              <input
                type="text"
                value={make}
                onChange={(event) =>
                  setMake(
                    event.target.value
                  )
                }
                placeholder="Toyota"
                className="input-field"
              />
            </div>

            <div>
              <label className="label">
                Model
              </label>

              <input
                type="text"
                value={model}
                onChange={(event) =>
                  setModel(
                    event.target.value
                  )
                }
                placeholder="Vios"
                className="input-field"
              />
            </div>

          </div>

          <div>

            <label className="label">
              Color
            </label>

            <select
              value={color}
              onChange={(event) =>
                setColor(
                  event.target.value
                )
              }
              className="input-field"
            >

              <option value="">
                Select color
              </option>

              {[
                "White",
                "Black",
                "Silver",
                "Gray",
                "Red",
                "Blue",
                "Green",
                "Yellow",
                "Brown",
                "Orange",
              ].map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ))}

            </select>

          </div>

          <div>

            <label className="label">
              Vehicle Type
            </label>

            <div className="grid grid-cols-3 gap-2">

              {VEHICLE_TYPES.map(
                (item) => {

                  const Icon =
                    item.value ===
                    "public"
                      ? Bus
                      : item.value ===
                          "essu-owned"
                        ? Building2
                        : Car;

                  return (
                    <button
                      key={item.value}
                      onClick={() =>
                        setType(
                          item.value
                        )
                      }
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 ${
                        type ===
                        item.value
                          ? "border-primary-500 bg-primary-50"
                          : "border-gray-200"
                      }`}
                    >

                      <Icon size={20} />

                      <span className="text-xs font-semibold">
                        {item.label}
                      </span>

                    </button>
                  );
                }
              )}

            </div>

          </div>

          <div>

            <label className="label">
              Registration Status
            </label>

            <div className="grid grid-cols-2 gap-2">

              <button
                onClick={() =>
                  setRegStatus(
                    "registered"
                  )
                }
                className={`p-3 rounded-xl border-2 ${
                  regStatus ===
                  "registered"
                    ? "border-primary-500 bg-primary-50"
                    : "border-gray-200"
                }`}
              >
                <Shield size={18} />
                <span className="text-sm font-semibold">
                  Registered
                </span>
              </button>

              <button
                onClick={() =>
                  setRegStatus(
                    "unregistered"
                  )
                }
                className={`p-3 rounded-xl border-2 ${
                  regStatus ===
                  "unregistered"
                    ? "border-error-500 bg-error-50"
                    : "border-gray-200"
                }`}
              >
                <ShieldOff size={18} />
                <span className="text-sm font-semibold">
                  Unregistered
                </span>
              </button>

            </div>

          </div>

          {error && (
            <div className="bg-error-50 border border-error-200 text-error-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            onClick={() =>
              void handleSave()
            }
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving
              ? "Saving..."
              : "Register Vehicle"}
          </button>

        </div>

      </div>
    </div>
  );
}

/* ============================================================
   CAMERAS
============================================================ */

function CamerasView({
  areas,
}: {
  areas: ParkingAreaWithStats[];
}) {
  const [
    activeCameras,
    setActiveCameras,
  ] = useState<Set<string>>(
    new Set()
  );

  function toggleCamera(
    areaId: string
  ) {
    setActiveCameras((previous) => {
      const next = new Set(previous);

      if (next.has(areaId)) {
        next.delete(areaId);
      } else {
        next.add(areaId);
      }

      return next;
    });
  }

  function turnAllOn() {
    setActiveCameras(
      new Set(
        areas.map((area) => area.id)
      )
    );
  }

  function turnAllOff() {
    setActiveCameras(new Set());
  }

  return (
    <div className="space-y-4 animate-fade-in">

      <div className="flex items-center justify-between">

        <div>
          <h3 className="section-title text-base">
            Live Camera Feeds
          </h3>

          <p className="text-xs text-gray-500 mt-0.5">
            {activeCameras.size} of{" "}
            {areas.length} cameras active
          </p>
        </div>

        <div className="flex items-center gap-2">

          <button
            onClick={turnAllOn}
            className="text-xs font-semibold text-primary-600 px-3 py-1.5 rounded-full bg-primary-50"
          >
            All On
          </button>

          <button
            onClick={turnAllOff}
            className="text-xs font-semibold text-gray-500 px-3 py-1.5 rounded-full bg-gray-100"
          >
            All Off
          </button>

        </div>

      </div>

      {areas.length === 0 ? (
        <div className="card p-8 text-center">

          <Camera
            size={36}
            className="text-gray-300 mx-auto mb-3"
          />

          <p className="text-sm text-gray-500">
            No parking areas available
          </p>

        </div>
      ) : (
        <div className="space-y-3">

          {areas.map((area) => {

            const isActive =
              activeCameras.has(area.id);

            return (
              <div
                key={area.id}
                className="card overflow-hidden"
              >

                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">

                  <div className="flex items-center gap-2.5">

                    <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-lg">
                      <span className="text-gray-700 font-bold text-[10px]">
                        {area.code}
                      </span>
                    </div>

                    <div>

                      <p className="font-semibold text-gray-900 text-sm">
                        {area.name}
                      </p>

                      <p className="text-[10px] text-gray-500">
                        {area.available_slots}/
                        {area.total_slots} slots
                        available
                      </p>

                    </div>

                  </div>

                  <button
                    onClick={() =>
                      toggleCamera(
                        area.id
                      )
                    }
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                      isActive
                        ? "bg-primary-100 text-primary-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {isActive
                      ? "On"
                      : "Off"}
                  </button>

                </div>

                <div className="relative aspect-video bg-gray-900 overflow-hidden">

                  {isActive ? (
                    <>
                      
<img
  src="http://127.0.0.1:8000/video-feed"
  className="absolute inset-0 h-full w-full object-contain"
  alt={`${area.code} live camera with license plate detection`}
/>


                      <div className="absolute top-3 left-3 flex items-center gap-1.5 pointer-events-none">

                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />

                        <span className="text-xs font-bold text-white">
                          REC
                        </span>

                      </div>

                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">

                        <span className="text-xs font-semibold text-white">
                          {area.code} -{" "}
                          {area.name}
                        </span>

                        <span className="text-xs text-white/80">
                          {area.available_slots}{" "}
                          slots open
                        </span>

                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">

                      <div className="text-center">

                        <VideoOff
                          size={32}
                          className="text-gray-600 mx-auto mb-2"
                        />

                        <p className="text-gray-500 text-xs">
                          Camera feed is off
                        </p>

                        <p className="text-gray-600 text-[10px] mt-1">
                          Tap "On" to view
                          live footage
                        </p>

                      </div>

                    </div>
                  )}

                </div>

              </div>
            );
          })}

        </div>
      )}

    </div>
  );
}

/* ============================================================
   USERS
============================================================ */

function UsersManagement({
  profiles,
  vehicles,
  violations,
}: {
  profiles: Profile[];
  vehicles: Vehicle[];
  violations: Violation[];
}) {
  const [search, setSearch] =
    useState("");

  const filtered =
    profiles.filter((profile) => {
      const query =
        search.toLowerCase();

      return (
        !query ||
        (profile.full_name ?? "")
          .toLowerCase()
          .includes(query) ||
        profile.id
          .toLowerCase()
          .includes(query)
      );
    });

  return (
    <div className="space-y-4 animate-fade-in">

      <h3 className="section-title text-base">
        Registered Users
      </h3>

      <div className="relative">

        <Search
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
        />

        <input
          type="text"
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search users..."
          className="input-field pl-11"
        />

      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center">

          <Users
            size={36}
            className="text-gray-300 mx-auto mb-3"
          />

          <p className="text-sm text-gray-500">
            No users found
          </p>

        </div>
      ) : (
        <div className="space-y-3">

          {filtered.map((profile) => {

            const userVehicles =
              vehicles.filter(
                (vehicle) =>
                  vehicle.user_id ===
                  profile.id
              );

            const userViolations =
              violations.filter(
                (violation) =>
                  violation.user_id ===
                  profile.id
              );

            return (
              <div
                key={profile.id}
                className="card p-4"
              >

                <div className="flex items-start justify-between mb-3">

                  <div className="flex items-center gap-3">

                    <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                      <User
                        size={18}
                        className="text-gray-500"
                      />
                    </div>

                    <div>

                      <div className="flex items-center gap-1.5">

                        <p className="font-semibold text-gray-900 text-sm">
                          {profile.full_name ??
                            "Unknown"}
                        </p>

                        {profile.role ===
                          "admin" && (
                          <span className="badge bg-gray-900 text-white text-[10px]">
                            Admin
                          </span>
                        )}

                      </div>

                      <p className="text-xs text-gray-500">
                        {profile.college_department ??
                          "No department"}
                      </p>

                    </div>

                  </div>

                </div>

                <div className="flex items-center gap-4 text-xs">

                  <span className="flex items-center gap-1.5 text-gray-600">
                    <Car
                      size={14}
                      className="text-gray-400"
                    />
                    {userVehicles.length}{" "}
                    vehicle
                    {userVehicles.length !==
                    1
                      ? "s"
                      : ""}
                  </span>

                  <span className="flex items-center gap-1.5 text-gray-600">
                    <AlertTriangle
                      size={14}
                      className="text-gray-400"
                    />
                    {userViolations.length}{" "}
                    violation
                    {userViolations.length !==
                    1
                      ? "s"
                      : ""}
                  </span>

                </div>

                {userVehicles.length >
                  0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">

                    {userVehicles.map(
                      (vehicle) => (
                        <div
                          key={vehicle.id}
                          className="flex items-center gap-2 text-xs"
                        >

                          <span className="font-mono font-semibold text-gray-700">
                            {
                              vehicle.plate_number
                            }
                          </span>

                          <span
                            className={`badge ${
                              vehicle.registration_status ===
                              "registered"
                                ? "bg-primary-100 text-primary-700"
                                : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {
                              vehicle.registration_status
                            }
                          </span>

                          <span className="badge bg-accent-100 text-accent-700 capitalize">
                            {vehicle.type.replace(
                              "-",
                              " "
                            )}
                          </span>

                        </div>
                      )
                    )}

                  </div>
                )}

              </div>
            );
          })}

        </div>
      )}

    </div>
  );
}