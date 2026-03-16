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
    console.info("[Share target] Arquivo disponível no layout", {
      name: sharedFile.name,
      type: sharedFile.type,
      size: sharedFile.size,
      pathname: location.pathname,
    });
    if (location.pathname !== "/") {
      navigate("/", { replace: true });
      return;
    }
    console.info("[Share target] Abrindo modal de novo lançamento");
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
