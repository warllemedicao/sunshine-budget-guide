import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[AppErrorBoundary] Erro de render no app:", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    try {
      window.location.href = "/";
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "hsl(243,75%,20%)",
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: "340px" }}>
            <p style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Algo deu errado
            </p>
            <p style={{ fontSize: "0.875rem", opacity: 0.7, marginBottom: "1.5rem" }}>
              Ocorreu um erro inesperado. Toque em recarregar para tentar novamente.
            </p>
            {this.state.error?.message && (
              <p
                style={{
                  fontSize: "0.75rem",
                  opacity: 0.5,
                  marginBottom: "1.5rem",
                  wordBreak: "break-word",
                  fontFamily: "monospace",
                }}
              >
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={this.handleReload}
              style={{
                padding: "0.5rem 1.5rem",
                background: "rgba(255,255,255,0.2)",
                border: "none",
                borderRadius: "0.5rem",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Recarregar app
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
