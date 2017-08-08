import * as _ from 'lodash';
import isReactComponentClass from 'babel-plugin-react-docgen/lib/isReactComponentClass';
import isStatelessComponent from 'babel-plugin-react-docgen/lib/isStatelessComponent';
import * as p from 'path';

export default function ({types: t}) {
  return {
    visitor: {
      Class(path, state) {
        if(!isReactComponentClass(path)) {
          return;
        }
        if(!path.node.id){
          return;
        }
        const className = path.node.id.name;

        if(!isExported(path, className, t)){
          return;
        }
        injectReactSourceText(className, path, state, this.file.code, t);
      },
      'CallExpression'(path, state) {
        const callee = path.node.callee;

        const objectName = _.get(callee, 'object.name') ? callee.object.name.toLowerCase() : null;
        const propertyName = _.get(callee, 'property.name') ? callee.property.name.toLowerCase() : null;
        const calleeName = _.get(callee, 'name') ? callee.name.toLowerCase() : null;

        // Detect `React.createClass()`
        const hasReactCreateClass = (objectName === 'react' && propertyName === 'createclass');

        // Detect `createReactClass()`
        const hasCreateReactClass = (calleeName === 'createreactclass');

        // Get React class name from variable declaration
        const className = _.get(path, 'parentPath.parent.declarations[0].id.name');

        // Detect `React.createElement()`
        const hasReactCreateElement = (objectName === 'react' && propertyName === 'createelement');

        if (className && (hasReactCreateClass || hasCreateReactClass)) {
          injectReactSourceText(className, path, state, this.file.code, t);
        }

        if (hasReactCreateElement) {
          const variableDeclaration = path.findParent((path) => path.isVariableDeclaration());

          if (variableDeclaration) {
            const elementClassName = variableDeclaration.node.declarations[0].id.name;
            if (!isExported(path, elementClassName, t)) {
              return;
            }

            injectReactSourceText(elementClassName, path, state, this.file.code, t);
          }
        }
      },
      'FunctionDeclaration|FunctionExpression|ArrowFunctionExpression'(path, state) {
        if(!isStatelessComponent(path)) {
          return;
        }
        if(!path.parentPath.node.id) {
          return;
        }
        const className = path.parentPath.node.id.name;

        if(!isExported(path, className, t)) {
          return;
        }
        injectReactSourceText(className, path, state, this.file.code, t);
      },
    }
  };
}

function isExported(path, className, t){
  const types = [
    'ExportDefaultDeclaration',
    'ExportNamedDeclaration'
  ];

  if(path.parentPath.node &&
     types.some(type => {return path.parentPath.node.type === type;})) {
    return true;
  }

  const program = path.scope.getProgramParent().path;
  return program.get('body').some(path => {
    if(path.node.type === 'ExportNamedDeclaration' &&
       path.node.specifiers &&
       path.node.specifiers.length) {
      return className === path.node.specifiers[0].exported.name;
    } else if(path.node.type === 'ExportDefaultDeclaration') {
      return className === path.node.declaration.name;
    }
    return false;
  });
}

function alreadyVisited(program, t) {
  return program.node.body.some(node => {
    if(t.isExpressionStatement(node) &&
       t.isAssignmentExpression(node.expression) &&
       t.isMemberExpression(node.expression.left)
      ) {
      return node.expression.left.property.name === '__sourceText';
    }
    return false;
  });
}

function injectReactSourceText(className, path, state, code, t) {
  const program = path.scope.getProgramParent().path;

  if (alreadyVisited(program, t)) {
    return;
  }

  const sourctText = t.expressionStatement(
    t.assignmentExpression(
      "=",
      t.memberExpression(t.identifier(className), t.identifier('__sourceText')),
      t.stringLiteral(code)
    ));
  program.pushContainer('body', sourctText);
}
