mod http;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    http::run().await
}
