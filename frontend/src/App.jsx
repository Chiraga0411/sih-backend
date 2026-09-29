import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Language from "./pages/Language";
import Home from "./pages/Home";
import ReportIssue from "./pages/ReportIssue";
import ReviewComplaint from "./pages/ReviewComplaint";
import DuplicateComplaint from "./pages/DuplicateComplaint";
import ComplaintSuccess from "./pages/ComplaintSuccess";
import MyComplaints from "./pages/MyComplaintes";
import ComplaintDetails from "./pages/ComplainDetails";
import Profile from "./pages/Profile";
import AdminLogin from "./admin/AdminLogin";
import AdminDashboard from "./admin/AdminDashboard";
import AdminGrievanceDetail from "./admin/AdminGrievanceDetail";
import AdminAnalytics from "./admin/AdminAnalytics";
import AdminBlocklist from "./admin/AdminBlocklist";

function Placeholder({ title }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f7f5]">
      <h1 className="text-2xl font-bold text-[#172b43]">
        {title}
      </h1>
    </div>
  );
}


function App() {
  return (
    <BrowserRouter>

      <Routes>

        {/* ================= LANGUAGE ================= */}

        <Route
          path="/"
          element={<Language />}
        />


        {/* ================= HOME ================= */}

        <Route
          path="/home"
          element={<Home />}
        />


        {/* ================= REPORT ISSUE ================= */}

        <Route
          path="/report"
          element={<ReportIssue />}
        />


        {/* ================= REVIEW COMPLAINT ================= */}

        <Route
          path="/report/review"
          element={<ReviewComplaint />}
        />


        {/* ================= DUPLICATE CHECK ================= */}

        <Route
          path="/report/duplicate"
          element={<DuplicateComplaint />}
        />


        {/* ================= SUCCESS ================= */}

        <Route
          path="/report/success"
          element={<ComplaintSuccess />}
        />


        {/* ================= TRACK COMPLAINTS ================= */}

        <Route
          path="/track"
          element={<MyComplaints />}
        />


        {/* ================= COMPLAINT DETAILS ================= */}

        <Route
          path="/track/:id"
          element={<ComplaintDetails />}
        />


        {/* ================= PROFILE ================= */}

        <Route
          path="/profile"
          element={
            <Profile />
          }
        />


        {/* ================= ADMIN (separate surface, own login — never linked from citizen UI) ================= */}

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/grievances/:id" element={<AdminGrievanceDetail />} />
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
        <Route path="/admin/blocklist" element={<AdminBlocklist />} />


        {/* ================= UNKNOWN ROUTE ================= */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>

    </BrowserRouter>
  );
}

export default App;