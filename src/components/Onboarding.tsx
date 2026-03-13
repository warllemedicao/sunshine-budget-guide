import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  {
    title: "Bem-vindo ao Sunshine Budget!",
    content: "Este app ajuda você a controlar suas finanças pessoais de forma simples e intuitiva.",
    icon: "☀️"
  },
  {
    title: "Adicione seus cartões",
    content: "Configure seus cartões de crédito no perfil para acompanhar faturas automaticamente.",
    icon: "💳"
  },
  {
    title: "Registre lançamentos",
    content: "Toque no botão + para adicionar receitas e despesas. Use o wizard para facilitar.",
    icon: "📝"
  },
  {
    title: "Acompanhe objetivos",
    content: "Defina metas de economia e veja seu progresso visualmente.",
    icon: "🎯"
  },
  {
    title: "Visualize gráficos",
    content: "Veja relatórios de gastos por categoria e tendências ao longo do tempo.",
    icon: "📊"
  }
];

interface OnboardingProps {
  open: boolean;
  onComplete: () => void;
}

const Onboarding = ({ open, onComplete }: OnboardingProps) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  useEffect(() => {
    if (!open) setCurrentStep(0);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" hideClose>
        <DialogHeader>
          <DialogTitle className="text-center">
            {steps[currentStep].icon} {steps[currentStep].title}
          </DialogTitle>
        </DialogHeader>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground mb-6">
              {steps[currentStep].content}
            </p>
            <div className="flex justify-between items-center">
              <div className="flex gap-1">
                {steps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 w-2 rounded-full ${
                      index === currentStep ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleSkip}>
                  Pular
                </Button>
                <Button onClick={handleNext}>
                  {currentStep === steps.length - 1 ? "Começar" : "Próximo"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default Onboarding;