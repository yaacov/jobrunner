/**
 * Graph layout utilities for pipeline visualization
 * Uses ELK.js for automatic DAG layout
 */

import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import type { Pipeline, PipelineNode, PipelineEdge, PipelineGraph } from '../types/pipeline.js';

const elk = new ELK();

// Layout options for ELK
const layoutOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.spacing.nodeNode': '25',
  'elk.layered.spacing.nodeNodeBetweenLayers': '35',
  'elk.layered.nodePlacement.strategy': 'SIMPLE',
  'elk.edgeRouting': 'ORTHOGONAL',
};

/**
 * Convert a Pipeline to a graph representation
 */
export function pipelineToGraph(pipeline: Pipeline): PipelineGraph {
  const nodes: PipelineNode[] = [];
  const edges: PipelineEdge[] = [];
  const stepNames = new Set(pipeline.spec.steps.map(s => s.name));

  // Create nodes for each step
  pipeline.spec.steps.forEach((step, index) => {
    const status = pipeline.status?.steps?.find(s => s.name === step.name);

    nodes.push({
      id: step.name,
      type: 'step',
      data: { step, status },
      position: { x: 0, y: index * 120 }, // Initial position, will be recalculated
    });
  });

  // Create edges based on dependencies
  pipeline.spec.steps.forEach((step, index) => {
    if (step.runIf) {
      // Conditional execution - connect to specified steps
      step.runIf.steps.forEach(depStep => {
        if (stepNames.has(depStep)) {
          edges.push({
            id: `${depStep}->${step.name}`,
            source: depStep,
            target: step.name,
            type: step.runIf!.condition === 'fail' ? 'failure' : 'success',
            data: {
              condition: step.runIf!.condition || 'success',
              operator: step.runIf!.operator || 'and',
            },
          });
        }
      });
    } else if (index > 0) {
      // Sequential execution - connect to previous step
      const prevStep = pipeline.spec.steps[index - 1];
      edges.push({
        id: `${prevStep.name}->${step.name}`,
        source: prevStep.name,
        target: step.name,
        type: 'sequential',
      });
    }
  });

  return { nodes, edges };
}

/**
 * Apply automatic layout to graph nodes using ELK
 */
export async function layoutGraph(graph: PipelineGraph): Promise<PipelineGraph> {
  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions,
    children: graph.nodes.map(node => ({
      id: node.id,
      width: 240,
      height: 100,
    })),
    edges: graph.edges.map(edge => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })) as ElkExtendedEdge[],
  };

  const layoutedGraph = await elk.layout(elkGraph);

  // Update node positions from ELK layout
  const updatedNodes = graph.nodes.map(node => {
    const elkNode = layoutedGraph.children?.find(n => n.id === node.id);
    if (elkNode) {
      return {
        ...node,
        position: {
          x: elkNode.x || 0,
          y: elkNode.y || 0,
        },
      };
    }
    return node;
  });

  return {
    nodes: updatedNodes,
    edges: graph.edges,
  };
}

/**
 * Create a new empty pipeline
 */
export function createEmptyPipeline(name: string, namespace = 'default'): Pipeline {
  return {
    apiVersion: 'pipeline.yaacov.io/v1',
    kind: 'Pipeline',
    metadata: {
      name,
      namespace,
    },
    spec: {
      steps: [],
    },
  };
}

/**
 * Create a new step with default values
 */
export function createDefaultStep(name: string): Pipeline['spec']['steps'][0] {
  return {
    name,
    jobSpec: {
      template: {
        spec: {
          containers: [
            {
              name: 'main',
              image: 'registry.access.redhat.com/ubi9/ubi-minimal:latest',
              command: ['sh', '-c'],
              args: ['echo "Hello from step"'],
            },
          ],
          restartPolicy: 'Never',
        },
      },
    },
  };
}

/**
 * Validate step name
 */
export function validateStepName(name: string): { valid: boolean; error?: string } {
  if (!name) {
    return { valid: false, error: 'Name is required' };
  }
  if (name.length > 63) {
    return { valid: false, error: 'Name must be 63 characters or less' };
  }
  if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(name)) {
    return {
      valid: false,
      error:
        'Name must be lowercase alphanumeric with hyphens, starting and ending with alphanumeric',
    };
  }
  return { valid: true };
}

/**
 * Check if adding an edge would create a cycle
 */
export function wouldCreateCycle(
  edges: PipelineEdge[],
  newSource: string,
  newTarget: string
): boolean {
  // Build adjacency list
  const adjacency = new Map<string, Set<string>>();

  for (const edge of edges) {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, new Set());
    }
    adjacency.get(edge.source)!.add(edge.target);
  }

  // Add the new edge temporarily
  if (!adjacency.has(newSource)) {
    adjacency.set(newSource, new Set());
  }
  adjacency.get(newSource)!.add(newTarget);

  // DFS to detect cycle
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycle(node: string): boolean {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = adjacency.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }

  // Check from all nodes
  for (const node of adjacency.keys()) {
    if (!visited.has(node)) {
      if (hasCycle(node)) return true;
    }
  }

  return false;
}
