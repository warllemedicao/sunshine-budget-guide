import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import BottomNav from "./BottomNav";
import NovoLancamentoModal from "./NovoLancamentoModal";
import { useShareTarget } from "@/hooks/useShareTarget";

const AppLayout = () => {
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { sharedFile, clearSharedFile } = useShareTarget();

  useEffect(() => {
    if (!sharedFile) return;
    if (location.pathname !== "/") {
      navigate("/", { replace: true });
      return;
    }
    setShowModal(true);
  }, [sharedFile, location.pathname, navigate]);

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:pl-16">
      <Outlet />
      <BottomNav onAddClick={() => setShowModal(true)} />
      <NovoLancamentoModal
        open={showModal}
        onOpenChange={setShowModal}
        sharedFile={sharedFile}
        onSharedFileConsumed={clearSharedFile}
      />
    </div>
  );
};

export default AppLayout;
