/**
 * Expression Parser for Symbol Math Feature
 * Supports basic arithmetic operations and symbol substitution
 * Similar to TradingView's expression functionality
 */

class ExpressionParser {
    constructor() {
        this.operators = {
            '+': { precedence: 1, associativity: 'left' },
            '-': { precedence: 1, associativity: 'left' },
            '*': { precedence: 2, associativity: 'left' },
            '/': { precedence: 2, associativity: 'left' },
            '^': { precedence: 3, associativity: 'right' },
            '**': { precedence: 3, associativity: 'right' }
        };
    }

    /**
     * Tokenize the expression into symbols, numbers, and operators
     */
    tokenize(expression) {
        const tokens = [];
        let i = 0;
        
        while (i < expression.length) {
            const char = expression[i];
            
            // Skip whitespace
            if (char === ' ') {
                i++;
                continue;
            }
            
            // Handle numbers (including decimals)
            if (char.match(/\d/) || char === '.') {
                let number = '';
                while (i < expression.length && (expression[i].match(/[\d.]/) || expression[i] === '.')) {
                    number += expression[i];
                    i++;
                }
                tokens.push({ type: 'number', value: parseFloat(number) });
                continue;
            }
            
            // Handle operators
            if (expression.substr(i, 2) === '**') {
                tokens.push({ type: 'operator', value: '**' });
                i += 2;
                continue;
            }
            
            if ('+-*/^()'.includes(char)) {
                tokens.push({ type: char === '(' || char === ')' ? 'parenthesis' : 'operator', value: char });
                i++;
                continue;
            }
            
            // Handle symbols (stock symbols, currency codes, etc.)
            if (char.match(/[a-zA-Z]/)) {
                let symbol = '';
                while (i < expression.length && expression[i].match(/[a-zA-Z0-9]/)) {
                    symbol += expression[i];
                    i++;
                }
                tokens.push({ type: 'symbol', value: symbol.toUpperCase() });
                continue;
            }
            
            throw new Error(`Unexpected character: ${char}`);
        }
        
        return tokens;
    }

    /**
     * Convert infix notation to postfix using Shunting Yard algorithm
     */
    toPostfix(tokens) {
        const output = [];
        const operatorStack = [];
        
        for (const token of tokens) {
            if (token.type === 'number' || token.type === 'symbol') {
                output.push(token);
            } else if (token.type === 'operator') {
                while (
                    operatorStack.length > 0 &&
                    operatorStack[operatorStack.length - 1].type === 'operator' &&
                    this.operators[operatorStack[operatorStack.length - 1].value] &&
                    (
                        this.operators[operatorStack[operatorStack.length - 1].value].precedence > 
                        this.operators[token.value].precedence ||
                        (
                            this.operators[operatorStack[operatorStack.length - 1].value].precedence === 
                            this.operators[token.value].precedence &&
                            this.operators[token.value].associativity === 'left'
                        )
                    )
                ) {
                    output.push(operatorStack.pop());
                }
                operatorStack.push(token);
            } else if (token.value === '(') {
                operatorStack.push(token);
            } else if (token.value === ')') {
                while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].value !== '(') {
                    output.push(operatorStack.pop());
                }
                if (operatorStack.length === 0) {
                    throw new Error('Mismatched parentheses');
                }
                operatorStack.pop(); // Remove the '('
            }
        }
        
        while (operatorStack.length > 0) {
            if (operatorStack[operatorStack.length - 1].value === '(' || 
                operatorStack[operatorStack.length - 1].value === ')') {
                throw new Error('Mismatched parentheses');
            }
            output.push(operatorStack.pop());
        }
        
        return output;
    }

    /**
     * Evaluate postfix expression with symbol values
     */
    evaluatePostfix(postfixTokens, symbolValues) {
        const stack = [];
        
        for (const token of postfixTokens) {
            if (token.type === 'number') {
                stack.push(token.value);
            } else if (token.type === 'symbol') {
                if (symbolValues[token.value] === undefined) {
                    throw new Error(`Symbol ${token.value} not found`);
                }
                stack.push(symbolValues[token.value]);
            } else if (token.type === 'operator') {
                if (stack.length < 2) {
                    throw new Error('Invalid expression: not enough operands');
                }
                
                const b = stack.pop();
                const a = stack.pop();
                let result;
                
                switch (token.value) {
                    case '+':
                        result = a + b;
                        break;
                    case '-':
                        result = a - b;
                        break;
                    case '*':
                        result = a * b;
                        break;
                    case '/':
                        if (b === 0) {
                            throw new Error('Division by zero');
                        }
                        result = a / b;
                        break;
                    case '^':
                    case '**':
                        result = Math.pow(a, b);
                        break;
                    default:
                        throw new Error(`Unknown operator: ${token.value}`);
                }
                
                stack.push(result);
            }
        }
        
        if (stack.length !== 1) {
            throw new Error('Invalid expression');
        }
        
        return stack[0];
    }

    /**
     * Parse and evaluate expression
     */
    evaluate(expression, symbolValues) {
        try {
            const tokens = this.tokenize(expression);
            const postfix = this.toPostfix(tokens);
            return this.evaluatePostfix(postfix, symbolValues);
        } catch (error) {
            throw new Error(`Expression error: ${error.message}`);
        }
    }

    /**
     * Extract all symbols from expression
     */
    getSymbols(expression) {
        try {
            const tokens = this.tokenize(expression);
            const symbols = new Set();
            
            for (const token of tokens) {
                if (token.type === 'symbol') {
                    symbols.add(token.value);
                }
            }
            
            return Array.from(symbols);
        } catch (error) {
            return [];
        }
    }

    /**
     * Validate expression syntax
     */
    validate(expression) {
        try {
            const tokens = this.tokenize(expression);
            this.toPostfix(tokens);
            return { valid: true, message: 'Expression is valid' };
        } catch (error) {
            return { valid: false, message: error.message };
        }
    }

    /**
     * Format expression for display
     */
    formatExpression(expression, symbolValues) {
        try {
            const symbols = this.getSymbols(expression);
            let formatted = expression;
            
            // Replace symbols with their values for preview
            for (const symbol of symbols) {
                if (symbolValues[symbol] !== undefined) {
                    const value = symbolValues[symbol].toFixed(2);
                    formatted = formatted.replace(new RegExp(`\\b${symbol}\\b`, 'g'), `${symbol}(${value})`);
                }
            }
            
            return formatted;
        } catch (error) {
            return expression;
        }
    }
}

export default ExpressionParser;