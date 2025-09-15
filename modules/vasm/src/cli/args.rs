use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "Poom's Virtual Stack Machine")]
#[command(author = "Phoomparin Mano <poom@poom.dev>")]
pub struct Args {
    #[command(subcommand)]
    pub command: Option<Commands>,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Compile the source into bytecode.
    Compile {
        /// Path to the assembly source code.
        src: String,

        /// Path to the output bytecode.
        out: String,
    },

    /// Run the bytecode or text assembly format.
    Run {
        /// Path to the bytecode or assembly.
        path: String,

        /// Run from the text assembly source file instead.
        #[arg(short, long)]
        from_source: bool,

        /// Enable debug mode.
        #[arg(short, long)]
        debug: bool,
    },
}
