use snafu::ensure;
use crate::{ParseError, ScannerReachedEndOfLineSnafu};
use crate::ParseError::{InvalidDecimalDigit, InvalidHexDigit, PeekExceedsSourceLength};
use super::token::*;

type Errorable = Result<(), ParseError>;

#[derive(Debug)]
pub struct Scanner {
    pub source: String,
    pub tokens: Vec<Token>,

    pub start: usize,
    pub current: usize,
    pub line: usize,

    pub in_instruction: bool,
    pub in_definition: bool,
}

impl Scanner {
    pub fn new(src: &str) -> Scanner {
        Scanner {
            source: src.into(),
            tokens: vec![],

            start: 0,
            current: 0,
            line: 0,

            in_instruction: false,
            in_definition: false,
        }
    }

    pub fn scan_tokens(&mut self) -> Errorable {
        while !self.is_end() {
            self.start = self.current;
            self.scan_token()?;
        }

        Ok(())
    }

    fn peek(&self) -> Result<char, ParseError> {
        if self.is_end() { return Ok('\0'); }

        self.source.chars().nth(self.current).ok_or(PeekExceedsSourceLength)
    }

    fn peek_next(&self) -> Result<char, ParseError> {
        if self.is_end() { return Ok('\0'); }

        self.source.chars().nth(self.current + 1).ok_or(PeekExceedsSourceLength)
    }

    fn is_end(&self) -> bool {
        self.current >= self.source.len()
    }

    fn advance(&mut self) -> Result<char, ParseError> {
        ensure!(!self.is_end(), ScannerReachedEndOfLineSnafu);

        let v = self.peek();
        self.current += 1;
        v
    }

    fn newline(&mut self) {
        self.line += 1;
        self.in_instruction = false;
        self.in_definition = false;
    }

    fn scan_token(&mut self) -> Result<(), ParseError> {
        let char = self.advance()?;

        match char {
            ' ' | '\r' | '\t' => {}

            // Comments
            ';' => {
                while !self.is_end() && self.peek()? != '\n' {
                    self.advance()?;
                }
            }

            '"' => self.string()?,

            // Newlines
            '\n' => self.newline(),

            // Data definition
            '.' => {
                if self.in_instruction || self.in_definition { return Ok(()); }

                while is_identifier(self.peek()?) {
                    self.advance()?;
                }

                let text = self.peek_lexeme();

                let token = match &*text {
                    ".string" => Some(TokenType::StringDefinition),
                    ".value" => Some(TokenType::ValueDefinition),
                    _ => None
                };

                if let Some(t) = token {
                    self.add_token(t);
                    self.in_instruction = false;
                    self.in_definition = true;
                }
            }

            // Parse hexadecimals.
            c if c == '0' && !self.is_end() && self.peek()? != ' ' && self.peek_next()? != ' ' => {
                let char = self.advance()?;

                match char {
                    'x' => {
                        self.advance()?;
                        self.hex()?
                    }

                    'b' => {
                        self.advance()?;
                        self.binary_digit()?
                    }

                    '\n' => {
                        self.decimal()?;
                        self.newline();
                    }

                    _ => self.decimal()?,
                }
            }

            // Parse decimals.
            c if c.is_digit(10) => self.decimal()?,

            // Parse identifiers.
            c if is_identifier(c) => self.identifier()?,

            _ => {}
        }

        if self.is_end() { return Ok(()); }

        Ok(())
    }

    fn decimal(&mut self) -> Errorable {
        while self.peek()?.is_digit(10) && !self.is_end() {
            self.advance()?;
        }

        let lexeme = self.peek_lexeme();
        let number = lexeme.trim().parse::<u16>().map_err(|_| InvalidDecimalDigit { text: lexeme.trim().into() })?;

        self.add_token(TokenType::Value(number));
        Ok(())
    }

    fn hex(&mut self) -> Errorable {
        while self.peek()?.is_digit(16) && !self.is_end() {
            self.advance()?;
        }

        let text = self.peek_lexeme();
        let text = text.trim();

        let hex_str = text.strip_prefix("0x").ok_or(InvalidHexDigit { text: text.into() })?;
        let num = u16::from_str_radix(hex_str, 16).map_err(|_| InvalidHexDigit { text: text.into() })?;

        self.add_token(TokenType::Value(num));

        Ok(())
    }

    fn binary_digit(&mut self) -> Errorable {
        while self.peek()?.is_digit(2) && !self.is_end() {
            self.advance()?;
        }

        let text = self.peek_lexeme();
        let hex_str = text.strip_prefix("0b").expect("no binary prefix");
        let num = u16::from_str_radix(hex_str, 2).expect("invalid binary");
        self.add_token(TokenType::Value(num));

        Ok(())
    }

    fn string(&mut self) -> Errorable {
        while self.peek()? != '"' && !self.is_end() {
            if self.peek()? == '\n' {
                self.line += 1;
            }

            self.advance()?;
        }

        // The closing quotes.
        self.advance()?;

        // Trim the surrounding quotes.
        let text = self.source[(self.start + 1)..(self.current - 1)].to_string();
        self.add_token(TokenType::String(text));

        Ok(())
    }

    fn identifier(&mut self) -> Errorable {
        while is_identifier(self.peek()?) {
            self.advance()?;
        }

        match self.peek()? {
            // Label definition
            ':' => {
                self.advance()?;
                self.add_token(TokenType::LabelDefinition);
            }

            _ if self.in_definition => {
                self.add_token(TokenType::Identifier);
            }

            _ if !self.in_instruction => {
                self.add_token(TokenType::Instruction);
                self.in_instruction = true;
            }

            _ => {
                self.add_token(TokenType::Identifier);
            }
        }

        Ok(())
    }

    fn add_token(&mut self, t: TokenType) {
        self.tokens.push(Token {
            token_type: t,
            lexeme: self.peek_lexeme(),
            line: self.line,
        });
    }

    fn peek_lexeme(&self) -> String {
        self.source[self.start..self.current].to_string()
    }
}

impl TryFrom<&str> for Scanner {
    type Error = ParseError;

    fn try_from(source: &str) -> Result<Self, Self::Error> {
        let mut s = Scanner::new(source);
        s.scan_tokens()?;
        Ok(s)
    }
}

#[cfg(test)]
mod tests {
    use crate::{load_test_file, Scanner, TokenType};

    #[test]
    fn test_string_data_in_assembly() {
        let s: Result<Scanner, _> = (*load_test_file("hello-world.asm")).try_into();
        let s = s.expect("cannot read test file");

        assert_eq!(s.tokens[0].token_type, TokenType::StringDefinition);
        assert_eq!(s.tokens[1].token_type, TokenType::Identifier);
        assert_eq!(s.tokens[2].token_type, TokenType::String("Hello, world!".into()));
    }

    #[test]
    fn parse_decimal_zero() {
        let s: Scanner = "send 0 1".try_into().expect("cannot parse decimal zero");

        assert_eq!(s.tokens[0].token_type, TokenType::Instruction);
        assert_eq!(s.tokens[1].token_type, TokenType::Value(0));
        assert_eq!(s.tokens[2].token_type, TokenType::Value(1));
    }
}