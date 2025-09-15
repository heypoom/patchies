#[derive(Clone, Debug, PartialEq)]
pub enum TokenType {
    /// Label definition ends with a colon, such as "start:"
    LabelDefinition,

    /// String definition keyword: ".string"
    StringDefinition,

    /// String such as `"hello, world!"`
    String(String),

    /// Value definition keyword: ".value"
    ValueDefinition,

    /// Instruction starts a line, such as "push"
    Instruction,

    /// Value in hex or decimal format, such as "0xFFFF" or "15"
    Value(u16),

    /// Name of the label or symbol.
    Identifier,

    /// End of file.
    Eof,
}

#[derive(Clone, Debug)]
pub struct Token {
    pub token_type: TokenType,
    pub lexeme: String,
    pub line: usize,
}

pub fn is_identifier(c: char) -> bool {
    c.is_alphanumeric() || c == '_'
}
