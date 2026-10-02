import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ToastProvider } from "./contexts/ToastContext";

import LandingPage from "./pages/LandingPage";
import About from "./pages/About";
import Terms from "./pages/Terms";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ListingsManagement from "./pages/ListingsManagement";
import CreateListing from "./pages/CreateListing";
import CreateListingMaterialDetails from "./pages/CreateListingMaterialDetails";
import CreateListingSetPrice from "./pages/CreateListingSetPrice";
import CreateListingReview from "./pages/CreateListingReview";
import ListingPublished from "./pages/ListingPublished";
import ProducerDashboard from "./pages/ProducerDashboard";
import Inventory from "./pages/Inventory";
import Marketplace from "./pages/Marketplace";
import AIRecognition from "./pages/AIRecognition";
import BuyerDashboard from "./pages/BuyerDashboard";
import BuyerOrders from "./pages/BuyerOrders";
import BuyerMessages from "./pages/BuyerMessages";
import SellerMessages from "./pages/SellerMessages";
import AccountSettings from "./pages/AccountSettings";
import SellerTransactions from "./pages/SellerTransactions";
import Search from "./pages/Search";

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/about" element={<About />} />
        <Route path="/buyer/dashboard" element={<BuyerDashboard />} />
        <Route path="/buyer/orders" element={<BuyerOrders />} />
        <Route path="/buyer/account" element={<AccountSettings />} />
        <Route path="/buyer/messages" element={<BuyerMessages />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/register" element={<Register />} />
        <Route path="/login" element={<Login />} />
        <Route path="/listings" element={<ListingsManagement />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/seller/listings" element={<ListingsManagement />} />
        <Route path="/seller/inventory" element={<Inventory />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/seller/dashboard" element={<ProducerDashboard />} />
        <Route path="/seller/messages" element={<SellerMessages />} />
        <Route path="/seller/account" element={<AccountSettings />} />
        <Route path="/seller/scan" element={<AIRecognition />} />
        <Route path="/seller/transactions" element={<SellerTransactions />} />
        <Route path="/seller/offers" element={<ListingsManagement />} />
        <Route path="/search" element={<Search />} />
        <Route path="/seller/listing-published" element={<ListingPublished />} />
        <Route path="/seller/create-listing/review" element={<CreateListingReview />} />
        <Route path="/seller/create-listing/price" element={<CreateListingSetPrice />} />
        <Route path="/seller/create-listing/material-details" element={<CreateListingMaterialDetails />} />
        <Route path="/seller/create-listing/scan" element={<AIRecognition />} />
        <Route path="/seller/create-listing" element={<CreateListing />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;




