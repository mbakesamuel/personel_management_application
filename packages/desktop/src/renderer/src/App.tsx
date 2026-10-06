import { useEffect, useMemo, useState } from "react";
import type { FinancialYear, User } from "@personel-management-app/shared";
import { BarChart3, ClipboardList, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setCurrentUserId } from "./api/client";
import { AppraisalConsole } from "./components/AppraisalConsole";
import { AppraisalSummaryConsole } from "./components/AppraisalSummaryConsole";
import {
  AppSidebar,
  type AppView,
  type SidebarGroup,
  type SidebarItem,
} from "./components/AppSidebar";
import { DecisionMatricConsole } from "./components/DecisionMatricConsole";
import { DashboardGroupsConsole } from "./components/DashboardGroupsConsole";
import { HomeDashboard } from "./components/HomeDashboard";
import { FinancialYearsConsole } from "./components/FinancialYearsConsole";
import { Footer } from "./components/Footer";
import { LetterCopiesConsole } from "./components/LetterCopiesConsole";
import { LettersConsole } from "./components/LettersConsole";
import { AllocationLettersConsole } from "./components/AllocationLettersConsole";
import { Login } from "./components/Login";
import { ChangePassword } from "./components/ChangePassword";
import { OrganizationConsole } from "./components/OrganizationConsole";
import { AllowancesConsole } from "./components/AllowancesConsole";
import { OperatorsConsole } from "@/components/OperatorsConsole";
import { OperatorAccountsConsole } from "@/components/OperatorAccountsConsole";
import { RegistrationsConsole } from "@/components/RegistrationsConsole";
import {
  AllowanceChangesConsole,
  type CorrespondenceFocus,
} from "@/components/AllowanceChangesConsole";
import { AllowanceHistoryConsole } from "@/components/AllowanceHistoryConsole";
import { AllowanceChangeLettersConsole } from "@/components/AllowanceChangeLettersConsole";
import { CommunicationLinesConsole } from "@/components/CommunicationLinesConsole";
import { OperatorExportConsole } from "@/components/OperatorExportConsole";
import { PersonnelConsole } from "./components/PersonnelConsole";
import { ViewErrorBoundary } from "./components/ViewErrorBoundary";
import { PositionKeywordsConsole } from "./components/PositionKeywordsConsole";
import { AllowanceMatrixConsole } from "./components/AllowanceMatrixConsole";
import { RolesConsole } from "./components/RolesConsole";
import { JurisdictionsConsole } from "./components/JurisdictionsConsole";
import { SalaryReviewExportConsole } from "./components/SalaryReviewExportConsole";
import { SalaryReviewImportConsole } from "./components/SalaryReviewImportConsole";
import { FleetImportConsole } from "./components/FleetImportConsole";
import { ThroOfficersConsole } from "./components/ThroOfficersConsole";
import { TopNav } from "./components/TopNav";
import { ThemeToggle } from "./components/ThemeToggle";
import { UsersConsole } from "./components/UsersConsole";
import welcomeSrc from "./assets/welcome.jpg";
import { LOGO_SRC } from "./lib/logo";
import { REPORT_COMPANY_NAME } from "./components/ReportHeader";

const SIDEBAR_COLLAPSED_KEY = "pma-sidebar-collapsed";
const APP_TITLE = "Personel Management Application";
function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [financialYear, setFinancialYear] = useState<FinancialYear | null>(
    null,
  );
  const [view, setView] = useState<AppView>("home");
  const [correspondenceFocus, setCorrespondenceFocus] =
    useState<CorrespondenceFocus | null>(null);
  const [memoOperatorId, setMemoOperatorId] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] =
    useState(readSidebarCollapsed);
  const [authScreen, setAuthScreen] = useState<
    "welcome" | "login" | "change-password"
  >("welcome");
  const [pendingUsername, setPendingUsername] = useState<string | null>(null);

  useEffect(() => {
    if (
      (view === "operators" ||
        view === "operator-accounts" ||
        view === "registrations" ||
        view === "closed-registrations" ||
        view === "allowance-changes" ||
        view === "allowance-history" ||
        view === "allowance-change-letters" ||
        view === "communication-lines" ||
        view === "operator-exports") &&
      user &&
      !user.permissions.canCommunicationAllowance
    ) {
      setView("home");
    }
    if (view === "dashboard-groups" && user && !user.permissions.canRoles) {
      setView("home");
    }
  }, [view, user]);

  useEffect(() => {
    if (view !== "allowance-changes") {
      setCorrespondenceFocus(null);
      setMemoOperatorId(null);
    }
  }, [view]);

  function applyFinancialYear(next: FinancialYear | null, nextUser?: User) {
    setFinancialYear(next);
    if (nextUser) {
      setUser(nextUser);
    } else {
      setUser((prev) =>
        prev ? { ...prev, financialYearId: next?.id ?? null } : prev,
      );
    }
  }

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // ignore quota / private-mode failures
      }
      return next;
    });
  }

  const navGroups: SidebarGroup[] = useMemo(() => {
    const perms = user?.permissions;
    const processItems: SidebarItem[] = [
      {
        view: "financial-years" as const,
        label: "Open/Close year",
      },
      ...(perms?.canImportHistory
        ? [
            {
              view: "import-salary-review" as const,
              label: "Import Appraisals (From Excel)",
            },
          ]
        : []),
      ...(perms?.canImportFleet
        ? [
            {
              view: "import-fleet" as const,
              label: "Import fleet Data",
            },
          ]
        : []),
      ...(perms?.canExportHistory
        ? [
            {
              view: "export-salary-review" as const,
              label: "Export Appraisals (To Excel)",
            },
          ]
        : []),
      ...(perms?.canOrganization
        ? [
            {
              view: "organization" as const,
              label: "Depart/Units/Zones/Section",
            },
          ]
        : []),
      ...(perms?.canCommunicationAllowance
        ? [
            {
              view: "operators" as const,
              label: "Operator Management",
            },
            {
              view: "operator-accounts" as const,
              label: "Operator Accounts",
            },
          ]
        : []),
      ...(perms?.canLetterCc
        ? [
            {
              view: "letter-copies" as const,
              label: "Memo Copies (CC)",
            },
          ]
        : []),
      ...(perms?.canDecisionMatrix
        ? [
            {
              view: "decision-matric" as const,
              label: "Signature Matrix",
            },
          ]
        : []),
      ...(perms?.canThroughOfficers
        ? [
            {
              view: "thro-officers" as const,
              label: "Unit Hierarchy",
            },
          ]
        : []),
      ...(perms?.canUsers
        ? [
            {
              view: "users" as const,
              label: "User Accounts",
            },
          ]
        : []),
      ...(perms?.canRoles
        ? [
            {
              view: "roles" as const,
              label: "Roles & Permissions",
            },
            {
              view: "dashboard-groups" as const,
              label: "Dashboards",
            },
            {
              view: "jurisdictions" as const,
              label: "Jurisdictions",
            },
          ]
        : []),
    ];

    const operationItems: SidebarItem[] = [
      ...(perms?.canPersonnel
        ? [
            {
              view: "personnel" as const,
              label: "Personnel Management",
            },
          ]
        : []),
      ...(perms?.canAllowances
        ? [
            ...(perms.canAllowanceTypes ||
            perms.canAllowanceCatalog ||
            perms.canAllowanceRates ||
            perms.canAllowanceAllocations
              ? [
                  {
                    view: "allowances" as const,
                    label: "Allowances Management",
                  },
                ]
              : []),
            ...(perms.canPositionKeywords
              ? [
                  {
                    view: "position-keywords" as const,
                    label: "Position keywords",
                  },
                ]
              : []),
            ...(perms.canAllowanceMatrix
              ? [
                  {
                    view: "allowance-matrix" as const,
                    label: "Allowance matrix",
                  },
                ]
              : []),
          ]
        : []),
      ...(perms?.canCommunicationAllowance
        ? [
            {
              view: "registrations" as const,
              label: "Fleet Management",
            },
            {
              view: "closed-registrations" as const,
              label: "Closed registrations",
            },
            {
              view: "allowance-changes" as const,
              label: "Draft Correspondences",
            },
            {
              view: "allowance-history" as const,
              label: "Individual history",
            },
            {
              view: "operator-exports" as const,
              label: "Operator exports",
            },
          ]
        : []),
      ...(perms?.canAppraisals
        ? [
            {
              view: "appraisal-console" as const,
              label: "Performance Appraisal",
            },
          ]
        : []),
    ];

    const reportItems: SidebarItem[] = [
      ...(perms?.canAppraisals
        ? [
            {
              view: "letters" as const,
              label: "Appraisal Letters",
            },
            {
              view: "appraisal-summary" as const,
              label: "Appraisal Summary",
            },
          ]
        : []),
      ...(perms?.canAllowances && perms.canAllowanceAllocations
        ? [
            {
              view: "allocation-letters" as const,
              label: "Allocation Letters",
            },
          ]
        : []),
      ...(perms?.canCommunicationAllowance
        ? [
            {
              view: "allowance-change-letters" as const,
              label: "Print ",
            },
            {
              view: "communication-lines" as const,
              label: "Communication lines",
            },
          ]
        : []),
    ];

    return [
      ...(processItems.length > 0
        ? [
            {
              id: "parameters",
              label: "Parameters",
              icon: Settings2,
              items: processItems,
            },
          ]
        : []),
      ...(operationItems.length > 0
        ? [
            {
              id: "operations",
              label: "Operations",
              icon: ClipboardList,
              items: operationItems,
            },
          ]
        : []),
      ...(reportItems.length > 0
        ? [
            {
              id: "reports",
              label: "Reports",
              icon: BarChart3,
              items: reportItems,
            },
          ]
        : []),
    ];
  }, [user?.permissions]);

  if (!user) {
    return (
      <main className="relative flex h-screen flex-col items-center justify-center gap-6 overflow-hidden bg-muted/40 px-4">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>

        {authScreen === "welcome" ? (
          <>
            <div className="flex flex-col items-center gap-3">
              <img src={LOGO_SRC} alt="" className="h-20 w-20 object-contain" />
              <p className="text-center text-2xl font-bold text-yellow-400">
                {REPORT_COMPANY_NAME}
              </p>
            </div>

            <img
              src={welcomeSrc}
              alt=""
              className="max-h-[70vh] max-w-full object-contain"
            />
            <Button
              type="button"
              variant="link"
              className="text-base"
              onClick={() => setAuthScreen("login")}
            >
              Login
            </Button>
          </>
        ) : authScreen === "change-password" && pendingUsername ? (
          <>
            <header className="text-center">
              <h1 className="text-3xl font-bold tracking-tight">
                Personel Management Application
              </h1>
              <p className="mt-1 text-muted-foreground">
                Set a new password to continue.
              </p>
            </header>

            <ChangePassword
              username={pendingUsername}
              onChanged={(nextUser, nextYear) => {
                setCurrentUserId(nextUser.id);
                setUser(nextUser);
                setFinancialYear(nextYear);
                setPendingUsername(null);
                setAuthScreen("welcome");
              }}
              onCancel={() => {
                setPendingUsername(null);
                setAuthScreen("login");
              }}
            />
          </>
        ) : (
          <>
            <header className="text-center">
              <h1 className="text-3xl font-bold tracking-tight">
                Personel Management Application
              </h1>
              <p className="mt-1 text-muted-foreground">Sign in to continue.</p>
            </header>

            <Login
              onLogin={(nextUser, nextYear) => {
                setCurrentUserId(nextUser.id);
                setUser(nextUser);
                setFinancialYear(nextYear);
                setPendingUsername(null);
                setAuthScreen("welcome");
              }}
              onMustChangePassword={(username) => {
                setPendingUsername(username);
                setAuthScreen("change-password");
              }}
            />

            <Button
              type="button"
              variant="link"
              onClick={() => {
                setPendingUsername(null);
                setAuthScreen("welcome");
              }}
            >
              Back
            </Button>
          </>
        )}
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <TopNav
        user={user}
        financialYear={financialYear}
        onLogout={() => {
          setCurrentUserId(null);
          setUser(null);
          setFinancialYear(null);
          setView("home");
          setAuthScreen("welcome");
        }}
      />

      <div className="flex min-h-0 flex-1">
        <AppSidebar
          groups={navGroups}
          currentView={view}
          collapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          onNavigate={setView}
        />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {view === "appraisal-console" ? (
            <AppraisalConsole
              user={user}
              financialYear={financialYear}
              onClose={() => setView("home")}
            />
          ) : view === "financial-years" ? (
            <FinancialYearsConsole
              user={user}
              financialYear={financialYear}
              onFinancialYearChange={applyFinancialYear}
              onClose={() => setView("home")}
            />
          ) : view === "import-salary-review" ? (
            <SalaryReviewImportConsole onClose={() => setView("home")} />
          ) : view === "import-fleet" ? (
            <FleetImportConsole onClose={() => setView("home")} />
          ) : view === "export-salary-review" ? (
            <SalaryReviewExportConsole
              user={user}
              onClose={() => setView("home")}
            />
          ) : view === "organization" ? (
            <OrganizationConsole
              currentUser={user}
              onClose={() => setView("home")}
            />
          ) : view === "personnel" ? (
            <ViewErrorBoundary label="Personnel screen crashed">
              <PersonnelConsole
                currentUser={user}
                onClose={() => setView("home")}
              />
            </ViewErrorBoundary>
          ) : view === "allowances" ? (
            <AllowancesConsole
              currentUser={user}
              onClose={() => setView("home")}
            />
          ) : view === "operators" &&
            user.permissions.canCommunicationAllowance ? (
            <OperatorsConsole onClose={() => setView("home")} />
          ) : view === "operator-accounts" &&
            user.permissions.canCommunicationAllowance ? (
            <OperatorAccountsConsole onClose={() => setView("home")} />
          ) : view === "registrations" &&
            user.permissions.canCommunicationAllowance ? (
            <RegistrationsConsole
              onClose={() => setView("home")}
              onAppointmentClosed={(focus) => {
                setCorrespondenceFocus(focus);
                setView("allowance-changes");
              }}
            />
          ) : view === "closed-registrations" &&
            user.permissions.canCommunicationAllowance ? (
            <RegistrationsConsole
              variant="closed"
              onClose={() => setView("home")}
            />
          ) : view === "allowance-changes" &&
            user.permissions.canCommunicationAllowance ? (
            <AllowanceChangesConsole
              onClose={() => setView("home")}
              focus={correspondenceFocus}
              operatorId={memoOperatorId}
            />
          ) : view === "allowance-history" &&
            user.permissions.canCommunicationAllowance ? (
            <AllowanceHistoryConsole onClose={() => setView("home")} />
          ) : view === "allowance-change-letters" &&
            user.permissions.canCommunicationAllowance ? (
            <AllowanceChangeLettersConsole onClose={() => setView("home")} />
          ) : view === "communication-lines" &&
            user.permissions.canCommunicationAllowance ? (
            <CommunicationLinesConsole onClose={() => setView("home")} />
          ) : view === "operator-exports" &&
            user.permissions.canCommunicationAllowance ? (
            <OperatorExportConsole onClose={() => setView("home")} />
          ) : view === "position-keywords" ? (
            <PositionKeywordsConsole onClose={() => setView("home")} />
          ) : view === "allowance-matrix" ? (
            <AllowanceMatrixConsole onClose={() => setView("home")} />
          ) : view === "decision-matric" ? (
            <DecisionMatricConsole onClose={() => setView("home")} />
          ) : view === "thro-officers" ? (
            <ThroOfficersConsole onClose={() => setView("home")} />
          ) : view === "letter-copies" ? (
            <LetterCopiesConsole onClose={() => setView("home")} />
          ) : view === "users" ? (
            <UsersConsole currentUser={user} onClose={() => setView("home")} />
          ) : view === "roles" ? (
            <RolesConsole onClose={() => setView("home")} />
          ) : view === "dashboard-groups" && user.permissions.canRoles ? (
            <DashboardGroupsConsole onClose={() => setView("home")} />
          ) : view === "jurisdictions" ? (
            <JurisdictionsConsole onClose={() => setView("home")} />
          ) : view === "letters" ? (
            <LettersConsole
              user={user}
              financialYear={financialYear}
              onClose={() => setView("home")}
            />
          ) : view === "appraisal-summary" ? (
            <AppraisalSummaryConsole
              user={user}
              financialYear={financialYear}
              onClose={() => setView("home")}
            />
          ) : view === "allocation-letters" ? (
            <AllocationLettersConsole
              user={user}
              onClose={() => setView("home")}
            />
          ) : (
            <HomeDashboard
              user={user}
              onNavigate={setView}
              onOpenMemo={(operatorId) => {
                setMemoOperatorId(operatorId);
                setView("allowance-changes");
              }}
            />
          )}
        </main>
      </div>

      <Footer />
    </div>
  );
}
