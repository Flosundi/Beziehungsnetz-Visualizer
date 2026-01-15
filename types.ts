export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  initials: string;
  color: string;
  description?: string;
  info?: Record<string, string>; // Dynamic fields like "Firma", "Geburtstag"
  notes?: string; // Long text field
}

export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string;
  type: string;
  strength: number; // 1-5
  color?: string;
}

export interface ConnectionType {
  id: string;
  label: string;
  color: string;
}

export interface Network {
  id: string;
  name: string;
  icon: string; // Key for the icon identifier
  nodes: GraphNode[];
  links: GraphLink[];
  connectionTypes: ConnectionType[]; // Types specific to this network
  centralNodeId?: string; // ID of the main person
  profileIds: string[]; // Selected profiles (e.g., 'work', 'family') to determine which fields to show
}

export type InteractionMode = 'select' | 'connect';

export interface ViewportDimensions {
  width: number;
  height: number;
}