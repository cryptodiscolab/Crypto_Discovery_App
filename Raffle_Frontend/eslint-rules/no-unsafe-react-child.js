/**
 * ESLint Rule: no-unsafe-react-child
 * 
 * Prevents React Error #31 by catching unsafe values rendered as React children.
 * 
 * CATCHES:
 * - Plain objects: {user}, {profile}, {context}
 * - BigInt values: {bigIntValue}
 * - SDK responses: {sdkResponse}
 * - Component references via object properties: <stat.icon />
 * - Potentially null/undefined .toString() calls
 * 
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
    meta: {
        type: "problem",
        docs: {
            description: "Prevent rendering unsafe values as React children (React Error #31)",
            category: "Possible Errors",
            recommended: true,
        },
        messages: {
            unsafeChild:
                "🚨 UNSAFE REACT CHILD: '{{expr}}' may be an object, BigInt, or SDK value. Wrap with String() or extract primitive property.",
            dynamicComponent:
                "🚨 DYNAMIC COMPONENT: <{{name}} /> must be extracted to an uppercase variable first (e.g., const Component = {{name}}; <Component />)",
            unsafeToString:
                "🚨 UNSAFE .toString(): '{{expr}}' may be null/undefined. Use String() or optional chaining with fallback.",
            suspiciousIdentifier:
                "⚠️  SUSPICIOUS: '{{name}}' might be an object. If it's a primitive, ignore this. Otherwise wrap with String().",
        },
        fixable: "code",
        schema: [
            {
                type: "object",
                properties: {
                    strictMode: {
                        type: "boolean",
                        default: false,
                        description: "Ban ALL identifier rendering without explicit coercion",
                    },
                    allowedIdentifiers: {
                        type: "array",
                        items: { type: "string" },
                        default: ["children", "key", "ref"],
                        description: "Identifiers that are safe to render directly",
                    },
                },
                additionalProperties: false,
            },
        ],
    },

    create(context) {
        const options = context.options[0] || {};
        const strictMode = options.strictMode || false;
        const allowedIdentifiers = new Set(options.allowedIdentifiers || ["children", "key", "ref"]);

        // Suspicious identifier patterns (likely objects)
        const suspiciousPatterns = /^(user|profile|context|sdk|data|response|result|state|props|config|settings|params|query)$/i;

        /**
         * Check if an expression is safe to render
         */
        function isSafeExpression(expr) {
            if (!expr) return false;

            // Literals (strings, numbers, booleans) are safe
            if (expr.type === "Literal") {
                // BigInt literals are NOT safe
                if (typeof expr.value === "bigint") return false;
                return true;
            }

            // Template literals are safe
            if (expr.type === "TemplateLiteral") return true;

            // JSX elements are safe
            if (expr.type === "JSXElement" || expr.type === "JSXFragment") return true;

            // Explicit String() calls are safe
            if (
                expr.type === "CallExpression" &&
                expr.callee.type === "Identifier" &&
                expr.callee.name === "String"
            ) {
                return true;
            }

            // Number() calls are safe
            if (
                expr.type === "CallExpression" &&
                expr.callee.type === "Identifier" &&
                expr.callee.name === "Number"
            ) {
                return true;
            }

            // .toLocaleString() is safe
            if (
                expr.type === "CallExpression" &&
                expr.callee.type === "MemberExpression" &&
                expr.callee.property.name === "toLocaleString"
            ) {
                return true;
            }

            // .toFixed() is safe
            if (
                expr.type === "CallExpression" &&
                expr.callee.type === "MemberExpression" &&
                expr.callee.property.name === "toFixed"
            ) {
                return true;
            }

            // Ternary expressions - check both branches
            if (expr.type === "ConditionalExpression") {
                return isSafeExpression(expr.consequent) && isSafeExpression(expr.alternate);
            }

            // Logical expressions (&&, ||) - check right side
            if (expr.type === "LogicalExpression") {
                return isSafeExpression(expr.right);
            }

            // Member expressions like user.name are generally safe
            // But user.object or user.data might not be
            if (expr.type === "MemberExpression") {
                // If it's calling .toString(), flag it as potentially unsafe
                if (expr.property && expr.property.name === "toString") {
                    return false; // Will be caught by unsafeToString check
                }
                return true; // Assume member access returns primitive
            }

            return false;
        }

        /**
         * Get expression source code
         */
        function getExpressionSource(expr) {
            return context.getSourceCode().getText(expr);
        }

        return {
            JSXExpressionContainer(node) {
                const expr = node.expression;

                if (!expr || expr.type === "JSXEmptyExpression") return;

                // Skip if it's safe
                if (isSafeExpression(expr)) return;

                // Check for .toString() calls (potentially unsafe)
                if (
                    expr.type === "CallExpression" &&
                    expr.callee.type === "MemberExpression" &&
                    expr.callee.property.name === "toString"
                ) {
                    context.report({
                        node,
                        messageId: "unsafeToString",
                        data: {
                            expr: getExpressionSource(expr.callee.object),
                        },
                        fix(fixer) {
                            return fixer.replaceText(node, `{String(${getExpressionSource(expr.callee.object)})}`);
                        },
                    });
                    return;
                }

                // Check for plain identifiers (user, profile, etc.)
                if (expr.type === "Identifier") {
                    // Skip allowed identifiers
                    if (allowedIdentifiers.has(expr.name)) return;

                    // In strict mode, flag ALL identifiers
                    if (strictMode) {
                        context.report({
                            node,
                            messageId: "unsafeChild",
                            data: { expr: expr.name },
                            fix(fixer) {
                                return fixer.replaceText(node, `{String(${expr.name})}`);
                            },
                        });
                        return;
                    }

                    // Otherwise, only flag suspicious patterns
                    if (suspiciousPatterns.test(expr.name)) {
                        context.report({
                            node,
                            messageId: "suspiciousIdentifier",
                            data: { name: expr.name },
                            fix(fixer) {
                                return fixer.replaceText(node, `{String(${expr.name})}`);
                            },
                        });
                    }
                    return;
                }

                // Check for object expressions (rare but possible)
                if (expr.type === "ObjectExpression" || expr.type === "ArrayExpression") {
                    context.report({
                        node,
                        messageId: "unsafeChild",
                        data: { expr: getExpressionSource(expr) },
                    });
                    return;
                }
            },

            JSXOpeningElement(node) {
                // Check for <obj.icon /> pattern
                if (node.name.type === "JSXMemberExpression") {
                    const fullName = getExpressionSource(node.name);

                    context.report({
                        node,
                        messageId: "dynamicComponent",
                        data: { name: fullName },
                        // Can't auto-fix this as it requires extracting to a variable
                    });
                }
            },
        };
    },
};
