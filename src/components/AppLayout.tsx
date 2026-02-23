import { useState } from "react";
import { Outlet } from "react-router-dom";
import BottomNav from "./BottomNav";
import NovoLancamentoModal from "./NovoLancamentoModal";

const AppLayout = () => {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-screen bg-background pb-20">
      <Outlet />
      <BottomNav onAddClick={() => setShowModal(true)} />
      <NovoLancamentoModal open={showModal} onOpenChange={setShowModal} />
    </div>
  );
};

export default AppLayout;
