pub mod token;
pub mod scanner;
pub mod symbols;
pub mod parse_error;

pub use token::*;
pub use scanner::*;
pub use symbols::*;
pub use parse_error::*;

use std::str::FromStr;
use snafu::ensure;
use TokenType as T;
use crate::{DATA_START, Op};
use crate::ParseError::{CannotPeekAtToken, InvalidArgToken, InvalidByteValue, InvalidIdentifier, InvalidLabelDescription, InvalidStringValue, UndefinedInstruction, UndefinedSymbols};

type Errorable = Result<(), ParseError>;

#[derive(Clone)]
pub struct Parser {
    /// Source code.
    source: String,

    /// Tokens generated from the source code by the scanner.
    tokens: Vec<Token>,

    /// Output a set of operations.
    pub ops: Vec<Op>,

    /// Output a set of symbols.
    pub symbols: Symbols,

    /// Is the first pass of symbol scanning completed?
    symbol_scanned: bool,

    /// Current token index.
    current: usize,

    /// Current opcode offsets
    code_offset: u16,

    /// Current data offsets
    data_offset: u16,
}

impl Parser {
    pub fn new(source: &str) -> Parser {
        Parser {
            source: source.into(),
            tokens: vec![],
            ops: vec![],
            symbols: Symbols::new(),
            symbol_scanned: false,

            current: 0,
            code_offset: 0,
            data_offset: 0,
        }
    }

    pub fn parse(&mut self) -> Errorable {
        // Scan tokens from the source code.
        let mut scanner = Scanner::new(&self.source);
        scanner.scan_tokens()?;
        self.tokens = scanner.tokens;

        // Raise an error if the program is empty.
        ensure!(!self.tokens.is_empty(), EmptyProgramSnafu);

        // Pass 1: collect labels.
        self.parse_tokens()?;

        // Pass 2: collect op with memory offsets in labels.
        self.parse_tokens()?;

        Ok(())
    }

    pub fn parse_tokens(&mut self) -> Errorable {
        // Reset the parser state.
        self.current = 0;
        self.code_offset = 0;
        self.data_offset = 0;
        self.ops.clear();

        // Parse each token.
        while self.current < self.tokens.len() {
            let token = self.peek()?;
            self.parse_token(&token.clone())?;
        }

        // Mark symbol scanning phase to be completed.
        if !self.symbol_scanned {
            self.symbol_scanned = true;
        }

        Ok(())
    }

    fn parse_token(&mut self, token: &Token) -> Errorable {
        match token.token_type {
            T::LabelDefinition => self.save_label(token)?,
            T::Instruction => self.save_instruction(token)?,
            T::StringDefinition => self.save_string()?,
            T::ValueDefinition => self.save_value()?,
            T::Identifier => {}
            T::String(..) => {}
            T::Value(..) => {}
            T::Eof => {}
        }

        self.current += 1;

        Ok(())
    }

    fn advance(&mut self) {
        if self.current >= self.tokens.len() - 1 {
            println!("cannot advance! {} >= {}", self.current, self.tokens.len());
            return;
        }

        self.current += 1;
    }

    fn save_label(&mut self, token: &Token) -> Errorable {
        // Do not process labels if the label is already scanned in the first pass.
        if self.symbol_scanned { return Ok(()); }

        let key = token.lexeme.clone();
        let key = key.trim().strip_suffix(":").ok_or(InvalidLabelDescription)?;

        // Raise an error if the label was defined before.
        ensure!(!self.symbols.offsets.contains_key(key), DuplicateLabelDefinitionSnafu);

        // Define labels based on the token.
        let offset = self.code_offset;
        self.symbols.offsets.insert(key.to_owned(), offset);

        Ok(())
    }

    fn identifier_name(&self) -> Result<String, ParseError> {
        let token = self.peek()?;

        match token.token_type {
            TokenType::Identifier => Ok(token.lexeme.clone()),
            _ => Err(InvalidIdentifier),
        }
    }

    fn peek(&self) -> Result<&Token, ParseError> {
        self.tokens.get(self.current).ok_or(CannotPeekAtToken)
    }

    fn string_value(&self) -> Result<String, ParseError> {
        let token = self.peek()?;

        match &token.token_type {
            TokenType::String(value) => Ok(value.into()),
            _ => Err(InvalidStringValue),
        }
    }

    fn byte_value(&self) -> Result<u16, ParseError> {
        let token = self.peek()?;

        match token.token_type {
            TokenType::Value(value) => Ok(value),
            _ => Err(InvalidByteValue),
        }
    }

    fn symbol(&mut self) -> Result<Option<String>, ParseError> {
        // Do not process if the symbol is already scanned in the first pass.
        if self.symbol_scanned { return Ok(None); }

        self.advance();
        let key = self.identifier_name()?;

        // The same symbol is defined twice.
        ensure!(!self.symbols.offsets.contains_key(&key), DuplicateSymbolDefinitionSnafu);

        self.symbols.offsets.insert(key.clone(), self.data_offset);

        self.advance();
        self.data_offset += 1;

        Ok(Some(key))
    }

    fn save_string(&mut self) -> Errorable {
        let Some(key) = self.symbol().map_err(|_| InvalidIdentifier)? else {
            return Ok(());
        };

        // The same string is defined twice.
        ensure!(!self.symbols.strings.contains_key(&key), DuplicateStringDefinitionSnafu);

        let value = self.string_value()?;
        let len = value.len() as u16;
        self.data_offset += len;

        self.symbols.strings.insert(key.clone(), value);

        Ok(())
    }

    fn save_value(&mut self) -> Errorable {
        let Some(key) = self.symbol().map_err(|_| InvalidIdentifier)? else {
            return Ok(());
        };

        self.symbols.data.insert(key.clone(), vec![self.byte_value()?]);
        self.data_offset += 1;

        Ok(())
    }

    fn save_instruction(&mut self, token: &Token) -> Errorable {
        // Build the instruction from token.
        let op_str = token.lexeme.clone();
        let op = self.instruction(&op_str)?;

        let arity = op.arity() as u16;

        if op == Op::Noop { return Ok(()); }

        self.ops.push(op);
        self.code_offset += arity + 1;

        Ok(())
    }

    fn instruction(&mut self, op_str: &str) -> Result<Op, ParseError> {
        let mut errors: Vec<ParseError> = vec![];

        let arg_fn = || {
            self.arg().unwrap_or_else(|err| {
                errors.push(err);
                0x00
            })
        };

        let op = Op::from_str(op_str).map_err(|_| UndefinedInstruction { name: op_str.into() })?;
        let op = op.with_arg(arg_fn);
        ensure!(errors.is_empty(), InvalidArgumentSnafu {errors});

        Ok(op)
    }

    fn arg(&mut self) -> Result<u16, ParseError> {
        self.advance();

        let token = self.peek()?;

        match token.token_type {
            TokenType::Value(value) => Ok(value),
            TokenType::Identifier => self.op_arg(&token.clone()),
            _ => Err(InvalidArgToken)
        }
    }

    /// Return the memory offset of the label.
    fn op_arg(&mut self, token: &Token) -> Result<u16, ParseError> {
        // Return a placeholder for the scanning phase.
        if !self.symbol_scanned { return Ok(0x00); }

        let key = token.lexeme.trim();
        let offset = self.symbols.offsets.get(key).ok_or(UndefinedSymbols)?;

        // Strings should be loaded from the data segment.
        if self.symbols.strings.contains_key(key) {
            return Ok(DATA_START + *offset);
        }

        // Raw bytes are loaded directly into the code segment.
        if self.symbols.data.contains_key(key) {
            let value = self.symbols.data.get(key).ok_or(UndefinedSymbols)?;

            return value.get(0).copied().ok_or(UndefinedSymbols);
        }

        // Labels stores the offsets within the code segment.
        Ok(*offset)
    }
}

impl TryFrom<&str> for Parser {
    type Error = ParseError;

    fn try_from(source: &str) -> Result<Self, Self::Error> {
        let mut p = Parser::new(source);
        p.parse()?;
        Ok(p)
    }
}
