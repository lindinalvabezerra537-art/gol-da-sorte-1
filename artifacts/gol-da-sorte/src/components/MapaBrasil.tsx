import React, { useEffect, useState } from "react";

interface CidadeDados {
  estado: string;
  cidade: string;
  nomes: string[];
  x: number;
  y: number;
}

interface EstadoDados {
  estado: string;
  count: number;
}

const ESTADOS: Record<string, { x: number; y: number; sigla: string; nome: string }> = {
  RO: { x: 22, y: 42, sigla: "RO", nome: "Rondônia" },
  AC: { x: 10, y: 38, sigla: "AC", nome: "Acre" },
  AM: { x: 22, y: 22, sigla: "AM", nome: "Amazonas" },
  RR: { x: 28, y: 10, sigla: "RR", nome: "Roraima" },
  PA: { x: 42, y: 22, sigla: "PA", nome: "Pará" },
  AP: { x: 35, y: 10, sigla: "AP", nome: "Amapá" },
  TO: { x: 52, y: 45, sigla: "TO", nome: "Tocantins" },
  MA: { x: 60, y: 22, sigla: "MA", nome: "Maranhão" },
  PI: { x: 65, y: 30, sigla: "PI", nome: "Piauí" },
  CE: { x: 78, y: 28, sigla: "CE", nome: "Ceará" },
  RN: { x: 80, y: 26, sigla: "RN", nome: "Rio Grande do Norte" },
  PB: { x: 80, y: 32, sigla: "PB", nome: "Paraíba" },
  PE: { x: 78, y: 36, sigla: "PE", nome: "Pernambuco" },
  AL: { x: 80, y: 42, sigla: "AL", nome: "Alagoas" },
  SE: { x: 78, y: 45, sigla: "SE", nome: "Sergipe" },
  BA: { x: 72, y: 52, sigla: "BA", nome: "Bahia" },
  MG: { x: 60, y: 62, sigla: "MG", nome: "Minas Gerais" },
  ES: { x: 70, y: 65, sigla: "ES", nome: "Espírito Santo" },
  RJ: { x: 65, y: 68, sigla: "RJ", nome: "Rio de Janeiro" },
  SP: { x: 55, y: 70, sigla: "SP", nome: "São Paulo" },
  PR: { x: 50, y: 75, sigla: "PR", nome: "Paraná" },
  SC: { x: 55, y: 80, sigla: "SC", nome: "Santa Catarina" },
  RS: { x: 50, y: 85, sigla: "RS", nome: "Rio Grande do Sul" },
  MS: { x: 45, y: 65, sigla: "MS", nome: "Mato Grosso do Sul" },
  MT: { x: 42, y: 48, sigla: "MT", nome: "Mato Grosso" },
  GO: { x: 52, y: 58, sigla: "GO", nome: "Goiás" },
  DF: { x: 55, y: 58, sigla: "DF", nome: "Distrito Federal" },
};

const ESTADO_PATHS: Record<string, string> = {
  AC: "M6,35 L14,35 L14,42 L6,42 Z",
  AL: "M76,40 L84,40 L84,44 L76,44 Z",
  AP: "M32,8 L38,8 L38,13 L32,13 Z",
  AM: "M18,18 L28,18 L28,30 L18,30 Z",
  BA: "M68,48 L76,48 L76,58 L68,58 Z",
  CE: "M74,25 L82,25 L82,31 L74,31 Z",
  DF: "M53,56 L57,56 L57,60 L53,60 Z",
  ES: "M66,62 L74,62 L74,68 L66,68 Z",
  GO: "M50,54 L56,54 L56,62 L50,62 Z",
  MA: "M55,18 L65,18 L65,26 L55,26 Z",
  MT: "M38,42 L48,42 L48,54 L38,54 Z",
  MS: "M42,60 L50,60 L50,68 L42,68 Z",
  MG: "M55,58 L65,58 L65,66 L55,66 Z",
  PA: "M38,18 L48,18 L48,28 L38,28 Z",
  PB: "M78,30 L84,30 L84,35 L78,35 Z",
  PR: "M46,72 L54,72 L54,78 L46,78 Z",
  PE: "M74,34 L82,34 L82,38 L74,38 Z",
  PI: "M62,28 L68,28 L68,33 L62,33 Z",
  RJ: "M62,65 L68,65 L68,71 L62,71 Z",
  RN: "M78,24 L84,24 L84,28 L78,28 Z",
  RO: "M20,38 L26,38 L26,46 L20,46 Z",
  RS: "M46,82 L54,82 L54,88 L46,88 Z",
  RR: "M26,8 L30,8 L30,12 L26,12 Z",
  SC: "M52,78 L58,78 L58,82 L52,82 Z",
  SE: "M76,44 L80,44 L80,47 L76,47 Z",
  SP: "M52,68 L58,68 L58,72 L52,72 Z",
  TO: "M50,42 L58,42 L58,48 L50,48 Z",
};

const FRONTEIRAS: [string, string][] = [
  ["RO", "AM"], ["RO", "MT"], ["AC", "AM"], ["AM", "RR"], ["AM", "PA"],
  ["PA", "AP"], ["PA", "MA"], ["PA", "TO"], ["PA", "MT"], ["MA", "PI"],
  ["MA", "TO"], ["PI", "CE"], ["PI", "PE"], ["PI", "BA"], ["PI", "TO"],
  ["CE", "RN"], ["CE", "PB"], ["CE", "PE"], ["RN", "PB"], ["PB", "PE"],
  ["PE", "AL"], ["PE", "BA"], ["AL", "SE"], ["AL", "BA"], ["SE", "BA"],
  ["BA", "MG"], ["BA", "ES"], ["BA", "GO"], ["BA", "TO"], ["MG", "ES"],
  ["MG", "RJ"], ["MG", "SP"], ["MG", "GO"], ["ES", "RJ"], ["RJ", "SP"],
  ["SP", "PR"], ["SP", "MS"], ["SP", "MG"], ["SP", "GO"], ["PR", "SC"],
  ["PR", "MS"], ["SC", "RS"], ["RS", "MS"], ["MS", "MT"], ["MS", "GO"],
  ["MT", "GO"], ["MT", "TO"], ["GO", "DF"], ["GO", "TO"], ["GO", "BA"],
  ["DF", "MG"], ["DF", "GO"],
];

function apiUrl(path: string) {
  return `/api${path}`;
}

function distribuirCidades(estado: string, cidades: string[]): { x: number; y: number }[] {
  const base = ESTADOS[estado];
  if (!base) return [];
  if (cidades.length === 0) return [];
  if (cidades.length === 1) return [{ x: base.x, y: base.y + 3 }];
  const raio = 3;
  return cidades.map((_, i) => {
    const angle = (2 * Math.PI * i) / cidades.length - Math.PI / 2;
    return { x: base.x + raio * Math.cos(angle), y: base.y + 3 + raio * Math.sin(angle) };
  });
}

export default function MapaBrasil() {
  const [cidades, setCidades] = useState<CidadeDados[]>([]);
  const [estados, setEstados] = useState<EstadoDados[]>([]);
  const [hoverCidade, setHoverCidade] = useState<string | null>(null);
  const [hoverEstado, setHoverEstado] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch(apiUrl("/users/locations"));
        const data = await res.json();
        if (data?.cidades) {
          const cidadesPorEstado: Record<string, string[]> = {};
          for (const c of data.cidades) {
            const key = c.estado;
            if (!cidadesPorEstado[key]) cidadesPorEstado[key] = [];
            cidadesPorEstado[key].push(c.cidade);
          }
          const mapped: CidadeDados[] = [];
          for (const c of data.cidades) {
            const estadoCidades = cidadesPorEstado[c.estado] || [];
            const idx = estadoCidades.indexOf(c.cidade);
            const pos = distribuirCidades(c.estado, estadoCidades)[idx] || {
              x: ESTADOS[c.estado]?.x ?? 50,
              y: (ESTADOS[c.estado]?.y ?? 50) + 3,
            };
            mapped.push({ estado: c.estado, cidade: c.cidade, nomes: c.nomes || [], x: pos.x, y: pos.y });
          }
          setCidades(mapped);
        }
        if (data?.estados) setEstados(data.estados);
      } catch {
        setCidades([]);
        setEstados([]);
      }
    };
    fetchLocations();
    const interval = setInterval(fetchLocations, 10000);
    return () => clearInterval(interval);
  }, []);

  const hoverCidadeData = cidades.find((c) => `${c.estado}-${c.cidade}` === hoverCidade);
  const hoverEstadoData = estados.find((e) => e.estado === hoverEstado);

  const mapContent = (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      {/* Linhas de fronteira */}
      {FRONTEIRAS.map(([a, b], i) => {
        const pa = ESTADOS[a];
        const pb = ESTADOS[b];
        if (!pa || !pb) return null;
        return (
          <line
            key={`front-${i}`}
            x1={pa.x} y1={pa.y}
            x2={pb.x} y2={pb.y}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="0.3"
            strokeDasharray="0.6,0.6"
          />
        );
      })}

      {/* Polígonos de estado */}
      {Object.entries(ESTADOS).map(([key, estado]) => {
        const path = ESTADO_PATHS[key];
        const temCadastrados = estados.find((e) => e.estado === key);
        return (
          <g key={key}>
            {path && (
              <path
                d={path}
                fill={temCadastrados ? "rgba(255,215,0,0.06)" : "rgba(255,255,255,0.02)"}
                stroke={temCadastrados ? "rgba(255,215,0,0.2)" : "rgba(255,255,255,0.08)"}
                strokeWidth="0.3"
                onMouseEnter={() => setHoverEstado(key)}
                onMouseLeave={() => setHoverEstado(null)}
                style={{ cursor: "pointer" }}
              />
            )}
            <text
              x={estado.x}
              y={estado.y}
              textAnchor="middle"
              dominantBaseline="central"
              fill={temCadastrados ? "#FFD700" : "rgba(255,255,255,0.3)"}
              fontSize="2.5"
              fontWeight="800"
              fontFamily="Arial, sans-serif"
              style={{ pointerEvents: "none" }}
            >
              {estado.sigla}
            </text>
          </g>
        );
      })}

      {/* Pontinhos de cidade */}
      {cidades.map((cidade) => (
        <g key={`${cidade.estado}-${cidade.cidade}`}>
          <circle
            cx={cidade.x} cy={cidade.y} r="1.5"
            fill="rgba(255,215,0,0.2)"
            onMouseEnter={() => setHoverCidade(`${cidade.estado}-${cidade.cidade}`)}
            onMouseLeave={() => setHoverCidade(null)}
            style={{ cursor: "pointer" }}
          >
            <animate attributeName="r" values="1.5;2.2;1.5" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle
            cx={cidade.x} cy={cidade.y} r="0.8"
            fill="#FFD700"
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHoverCidade(`${cidade.estado}-${cidade.cidade}`)}
            onMouseLeave={() => setHoverCidade(null)}
          />
        </g>
      ))}
    </svg>
  );

  if (expanded) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 999,
          background: "#0a0a0a",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px",
        }}
      >
        <div style={{ width: "100%", height: "calc(100% - 60px)", maxHeight: "85vh" }}>
          {mapContent}
        </div>

        {/* Botão VOLTAR */}
        <button
          onClick={() => setExpanded(false)}
          style={{
            marginTop: 12,
            padding: "10px 32px",
            borderRadius: 10,
            border: "2px solid #FFD700",
            background: "transparent",
            color: "#FFD700",
            fontSize: 16,
            fontWeight: 900,
            textTransform: "uppercase",
            letterSpacing: 1,
            cursor: "pointer",
            boxShadow: "0 0 12px rgba(255,215,0,0.3)",
          }}
        >
          ⬅ VOLTAR
        </button>

        {/* Tooltips no overlay */}
        {hoverCidadeData && (
          <div
            style={{
              position: "fixed",
              left: `${(hoverCidadeData.x / 100) * window.innerWidth}px`,
              top: `${Math.max((hoverCidadeData.y / 100) * window.innerHeight - 5, 10)}px`,
              transform: "translate(-50%, -100%)",
              background: "rgba(0,0,0,0.92)",
              border: "1.5px solid #FFD700",
              borderRadius: 8,
              padding: "6px 10px",
              zIndex: 1000,
              minWidth: 120,
              maxWidth: 200,
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              pointerEvents: "none",
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 900, color: "#FFD700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, borderBottom: "1px solid rgba(255,215,0,0.3)", paddingBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {hoverCidadeData.cidade}, {hoverCidadeData.estado}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {hoverCidadeData.nomes.slice(0, 5).map((nome, i) => {
                const firstName = nome.split(" ")[0];
                return (
                  <div key={i} style={{ fontSize: 9, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <span style={{ color: "#FFD700", marginRight: 3 }}>⚽</span>
                    {firstName}
                  </div>
                );
              })}
              {hoverCidadeData.nomes.length > 5 && (
                <div style={{ fontSize: 8, color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>
                  ... e mais {hoverCidadeData.nomes.length - 5}
                </div>
              )}
            </div>
          </div>
        )}

        {hoverEstadoData && !hoverCidadeData && (
          <div
            style={{
              position: "fixed",
              left: `${(ESTADOS[hoverEstadoData.estado]?.x ?? 50) / 100 * window.innerWidth}px`,
              top: `${Math.max(((ESTADOS[hoverEstadoData.estado]?.y ?? 50) - 5) / 100 * window.innerHeight, 10)}px`,
              transform: "translate(-50%, -100%)",
              background: "rgba(0,0,0,0.85)",
              border: "1px solid #FFD700",
              borderRadius: 6,
              padding: "4px 8px",
              zIndex: 1000,
              whiteSpace: "nowrap",
              boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
              pointerEvents: "none",
            }}
          >
            <span style={{ fontSize: 9, color: "#FFD700", fontWeight: 900 }}>
              {ESTADOS[hoverEstadoData.estado]?.nome} • {hoverEstadoData.count}{" "}
              {hoverEstadoData.count === 1 ? "cadastrado" : "cadastrados"}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => setExpanded(true)}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: 8,
        background: "#0a0a0a",
        cursor: "pointer",
      }}
    >
      {mapContent}

      {/* Tooltips inline */}
      {hoverCidadeData && (
        <div
          style={{
            position: "absolute",
            left: `${hoverCidadeData.x}%`,
            top: `${Math.max(hoverCidadeData.y - 5, 2)}%`,
            transform: "translate(-50%, -100%)",
            background: "rgba(0,0,0,0.92)",
            border: "1.5px solid #FFD700",
            borderRadius: 8,
            padding: "6px 10px",
            zIndex: 30,
            minWidth: 120,
            maxWidth: 200,
            boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 900, color: "#FFD700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, borderBottom: "1px solid rgba(255,215,0,0.3)", paddingBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {hoverCidadeData.cidade}, {hoverCidadeData.estado}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {hoverCidadeData.nomes.slice(0, 5).map((nome, i) => {
              const firstName = nome.split(" ")[0];
              return (
                <div key={i} style={{ fontSize: 9, color: "#fff", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  <span style={{ color: "#FFD700", marginRight: 3 }}>⚽</span>
                  {firstName}
                </div>
              );
            })}
            {hoverCidadeData.nomes.length > 5 && (
              <div style={{ fontSize: 8, color: "rgba(255,255,255,0.5)", fontStyle: "italic" }}>
                ... e mais {hoverCidadeData.nomes.length - 5}
              </div>
            )}
          </div>
        </div>
      )}

      {hoverEstadoData && !hoverCidadeData && (
        <div
          style={{
            position: "absolute",
            left: `${ESTADOS[hoverEstadoData.estado]?.x ?? 50}%`,
            top: `${Math.max((ESTADOS[hoverEstadoData.estado]?.y ?? 50) - 5, 2)}%`,
            transform: "translate(-50%, -100%)",
            background: "rgba(0,0,0,0.85)",
            border: "1px solid #FFD700",
            borderRadius: 6,
            padding: "4px 8px",
            zIndex: 25,
            whiteSpace: "nowrap",
            boxShadow: "0 2px 10px rgba(0,0,0,0.4)",
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: 9, color: "#FFD700", fontWeight: 900 }}>
            {ESTADOS[hoverEstadoData.estado]?.nome} • {hoverEstadoData.count}{" "}
            {hoverEstadoData.count === 1 ? "cadastrado" : "cadastrados"}
          </span>
        </div>
      )}
    </div>
  );
}
