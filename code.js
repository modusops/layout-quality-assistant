// Simplified Figma Layout Quality Checker
figma.showUI(__html__, { width: 400, height: 620 });

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'analyze-selection') {
    await analyzeSelectedFrame();
  } else if (msg.type === 'select-node') {
    try {
      const node = await figma.getNodeByIdAsync(msg.nodeId);
      
      if (node) {
        // Check if node is a SceneNode (can be selected)
        if ('type' in node && node.type !== 'DOCUMENT' && node.type !== 'PAGE') {
          figma.currentPage.selection = [node];
          figma.viewport.scrollAndZoomIntoView([node]);
          figma.notify(`Selected: ${node.name}`);
        } else {
          figma.notify('This node type cannot be selected');
        }
      } else {
        figma.notify('Could not find that node');
      }
    } catch (error) {
      console.error('Error selecting node:', error);
      figma.notify(`Error selecting node: ${error.message}`);
    }
  } else if (msg.type === 'close') {
    figma.closePlugin();
  }
};

async function analyzeSelectedFrame() {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.ui.postMessage({
      type: 'error',
      message: 'Please select a frame to analyze'
    });
    return;
  }
  
  const selectedNode = selection[0];
  
  if (selectedNode.type !== 'FRAME') {
    figma.ui.postMessage({
      type: 'error',
      message: 'Please select a frame (not a component, group, or other element)'
    });
    return;
  }
  
  try {
    const issues = {
      unlabeledLayers: [],
      hiddenLayers: [],
      fractionalValues: [],
      groupsUsed: [],
      negativeSpacing: []
    };
    
    // Analyze the frame and all its children recursively
    analyzeNode(selectedNode, issues);
    
    figma.ui.postMessage({
      type: 'analysis-complete',
      frameName: selectedNode.name,
      issues: issues
    });
    
  } catch (error) {
    figma.ui.postMessage({
      type: 'error',
      message: `Analysis failed: ${error.message}`
    });
  }
}

function analyzeNode(node, issues) {
  // 1. Check for unlabeled layers
  checkUnlabeledLayers(node, issues);
  
  // 2. Check for hidden layers
  checkHiddenLayers(node, issues);
  
  // 3. Check for fractional values (not in 4px/8px increments, except 2px)
  checkFractionalValues(node, issues);
  
  // 4. Check for groups (should use frames instead)
  checkForGroups(node, issues);
  
  // // 5. Check for excessive absolute positioning (2 or more)
  // checkExcessiveAbsolutePositioning(node, issues);
  
  // 6. Check for negative spacing in autolayout
  checkNegativeSpacing(node, issues);
  
  // Recursively check children
  if ('children' in node) {
    for (const child of node.children) {
      analyzeNode(child, issues);
    }
  }
}

function checkUnlabeledLayers(node, issues) {
  const name = node.name.toLowerCase();
  
  // Check if name starts with default names
  const startsWithDefault = [
    'rectangle',
    'frame', 
    'group',
    'ellipse',
    'text',
    'component',
    'instance'
  ].some(defaultName => name.startsWith(defaultName));
  
  if (startsWithDefault) {
    issues.unlabeledLayers.push({
      name: node.name,
      type: node.type,
      id: node.id  // ADDED: Store node ID
    });
  }
}

function checkHiddenLayers(node, issues) {
  if (node.visible === false) {
    issues.hiddenLayers.push({
      name: node.name,
      type: node.type,
      id: node.id  // ADDED: Store node ID
    });
  }
}

function checkFractionalValues(node, issues) {
  const problematicValues = [];
  
  // Helper function to check if a value follows good spacing rules
  const isGoodSpacing = (value) => {
    // Must be a number (no fractional pixels)
    if (typeof value !== 'number' || value % 1 !== 0) {
      return false;
    }
    
    // Allow 0, 2px, or multiples of 4px and 8px
    if (value === 0 || value === 2 || value % 4 === 0 || value % 8 === 0) {
      return true;
    }
    
    return false;
  };
  
  
  // Check for autolayout frames
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    
    // 1. Check gap/spacing between items (try multiple property names)
    const gapProperties = [
      { value: node.itemSpacing, name: 'gap (itemSpacing)' },
      { value: node.gap, name: 'gap' },
      { value: node.spacing, name: 'spacing' }
    ];
    
    gapProperties.forEach(({ value, name }) => {
      console.log(`Checking ${name}: ${value} (type: ${typeof value})`);
      if (typeof value === 'number' && !isGoodSpacing(value)) {
        console.log(`❌ ${name} ${value}px is not good spacing`);
        problematicValues.push(`${name}: ${value}px`);
      } else if (typeof value === 'number') {
        console.log(`✅ ${name} ${value}px is good spacing`);
      }
    });
    
    // 2. Check padding values
    const paddingChecks = [
      { value: node.paddingTop, name: 'padding top' },
      { value: node.paddingBottom, name: 'padding bottom' },
      { value: node.paddingLeft, name: 'padding left' },
      { value: node.paddingRight, name: 'padding right' },
      { value: node.horizontalPadding, name: 'horizontal padding' },
      { value: node.verticalPadding, name: 'vertical padding' }
    ];
    
    paddingChecks.forEach(({ value, name }) => {
      console.log(`Checking ${name}: ${value} (type: ${typeof value})`);
      if (typeof value === 'number' && !isGoodSpacing(value)) {
        console.log(`❌ ${name} ${value}px is not good spacing`);
        problematicValues.push(`${name}: ${value}px`);
      } else if (typeof value === 'number') {
        console.log(`✅ ${name} ${value}px is good spacing`);
      }
    });
  } else {
    console.log(`Skipping spacing checks - no autolayout (layoutMode: ${node.layoutMode})`);
  }
  
  // 3. Check spacing between nested frames (manual positioning)
  if ('children' in node && node.children.length > 1) {
    const frameChildren = node.children.filter(child => child.type === 'FRAME');
    
    if (frameChildren.length > 1 && !node.layoutMode) {
      // Check horizontal spacing between frames
      for (let i = 0; i < frameChildren.length - 1; i++) {
        const current = frameChildren[i];
        const next = frameChildren[i + 1];
        
        // Calculate horizontal gap
        const horizontalGap = next.x - (current.x + current.width);
        if (horizontalGap > 0 && !isGoodSpacing(horizontalGap)) {
          problematicValues.push(`gap between "${current.name}" and "${next.name}": ${horizontalGap}px`);
        }
        
        // Calculate vertical gap  
        const verticalGap = next.y - (current.y + current.height);
        if (verticalGap > 0 && !isGoodSpacing(verticalGap)) {
          problematicValues.push(`vertical gap between "${current.name}" and "${next.name}": ${verticalGap}px`);
        }
      }
    }
  }
  
  if (problematicValues.length > 0) {
    console.log(`Found ${problematicValues.length} spacing issues in ${node.name}:`, problematicValues);
    issues.fractionalValues.push({
      name: node.name,
      type: node.type,
      values: problematicValues,
      id: node.id  // ADDED: Store node ID
    });
  } else {
    console.log(`✅ No spacing issues found in ${node.name}`);
  }
}

function checkForGroups(node, issues) {
  if (node.type === 'GROUP') {
    const childCount = 'children' in node ? node.children.length : 0;
    issues.groupsUsed.push({
      name: node.name,
      type: node.type,
      childCount: childCount,
      id: node.id  // ADDED: Store node ID
    });
  }
}

function checkNegativeSpacing(node, issues) {
  if (node.layoutMode && node.layoutMode !== 'NONE') {
    if (typeof node.itemSpacing === 'number' && node.itemSpacing < 0) {
      issues.negativeSpacing.push({
        name: node.name,
        type: node.type,
        spacing: node.itemSpacing,
        id: node.id  // ADDED: Store node ID
      });
    }
  }
}

// Send current selection info
function sendCurrentSelection() {
  const selection = figma.currentPage.selection;
  figma.ui.postMessage({
    type: 'selection-change',
    hasSelection: selection.length > 0,
    selectionName: selection.length > 0 ? selection[0].name : null,
    selectionType: selection.length > 0 ? selection[0].type : null
  });
}

// Send initial selection info
sendCurrentSelection();

// Listen for selection changes
figma.on('selectionchange', () => {
  sendCurrentSelection();
});