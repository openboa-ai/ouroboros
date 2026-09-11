//! Disposable PostgreSQL/host fixtures, separate from the behavior assertions.
//! Only explicitly supplied local test endpoints and private scratch directories are used.
use ouroboros_resources::{
    CatalogWorker, CompanyWorker,
    storage::{PrepareConfig, prepare},
};
use sqlx::PgPool;
use std::{
    future::Future,
    net::IpAddr,
    os::unix::fs::{DirBuilderExt, OpenOptionsExt, PermissionsExt},
    path::PathBuf,
};
use uuid::Uuid;

pub struct Fixture {
    admin: PgPool,
    database: String,
    role: String,
    pub owner: PgPool,
    pub worker: PgPool,
    pub firm: Uuid,
    pub root: PathBuf,
    pub content: PathBuf,
    pub binding_file: PathBuf,
    pub owner_url_file: PathBuf,
    pub worker_url: String,
    pub password: String,
}

impl Fixture {
    pub async fn new(catalog: bool) -> Self {
        let url_file = std::env::var("OURO_RESOURCE_TEST_ADMIN_URL_FILE")
            .expect("explicit disposable resource PostgreSQL administration URL file required");
        let source = std::fs::read_to_string(url_file).expect("read test administration URL");
        let mut url = reqwest::Url::parse(source.trim()).expect("valid explicit test URL");
        assert!(matches!(url.scheme(), "postgres" | "postgresql"));
        let host = url
            .host_str()
            .expect("numeric loopback test database host")
            .trim_matches(['[', ']']);
        assert!(
            host.parse::<IpAddr>()
                .expect("numeric test host")
                .is_loopback()
        );
        let scratch = PathBuf::from(
            std::env::var("OURO_TEST_TEMP_DIR")
                .expect("explicit private test scratch directory required"),
        );
        assert!(scratch.is_absolute() && scratch.canonicalize().unwrap() == scratch);
        let metadata = std::fs::metadata(&scratch).unwrap();
        assert!(metadata.is_dir() && metadata.permissions().mode() & 0o077 == 0);
        let root = scratch.join(format!("resource-contract-{}", Uuid::new_v4().simple()));
        std::fs::DirBuilder::new()
            .mode(0o700)
            .create(&root)
            .unwrap();
        let admin = PgPool::connect(url.as_str())
            .await
            .expect("connect disposable test administrator");
        // Audited DDL: identifiers and the password contain only fixed prefixes and UUID hex.
        let database = format!("ouro_contract_{}", Uuid::new_v4().simple());
        let role = format!("ouro_worker_{}", Uuid::new_v4().simple());
        let password = Uuid::new_v4().simple().to_string();
        sqlx::query(sqlx::AssertSqlSafe(format!("CREATE DATABASE {database}")))
            .execute(&admin)
            .await
            .unwrap();
        sqlx::query(sqlx::AssertSqlSafe(format!(
            "CREATE ROLE {role} LOGIN PASSWORD '{password}'"
        )))
        .execute(&admin)
        .await
        .unwrap();
        url.set_path(&format!("/{database}"));
        let owner_url_file = root.join("owner.url");
        use std::io::Write;
        std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .mode(0o600)
            .open(&owner_url_file)
            .unwrap()
            .write_all(url.as_str().as_bytes())
            .unwrap();
        let owner = PgPool::connect(url.as_str()).await.unwrap();
        if catalog {
            CatalogWorker::migrate(&owner).await.unwrap();
            sqlx::raw_sql(sqlx::AssertSqlSafe(format!("GRANT CONNECT ON DATABASE {database} TO {role};
                GRANT USAGE ON SCHEMA public TO {role};
                GRANT SELECT,INSERT,UPDATE ON workspaces,workspace_snapshots,uploads,publication_receipts,upload_staging,blob_objects,upload_object_holds,revision_object_holds,catalog_collections TO {role};
                GRANT SELECT,INSERT ON workspace_create_receipts,catalog_retirements TO {role};
                GRANT SELECT ON storage_binding TO {role};
                GRANT EXECUTE ON FUNCTION check_storage_binding(uuid,uuid,uuid) TO {role};")))
                .execute(&owner).await.unwrap();
        }
        url.set_username(&role).unwrap();
        url.set_password(Some(&password)).unwrap();
        let worker_url = url.to_string();
        let worker = PgPool::connect(&worker_url).await.unwrap();
        let firm = Uuid::new_v4();
        let content = root.join("content");
        let binding_file = root.join("binding.json");
        if catalog {
            std::fs::DirBuilder::new()
                .mode(0o700)
                .create(&content)
                .unwrap();
            let store_id = Uuid::new_v4();
            let generation = Uuid::new_v4();
            prepare(&PrepareConfig {
                root: content.clone(),
                binding_file: binding_file.clone(),
                owner_uid: unsafe { libc::geteuid() },
                firm_id: firm,
                store_id,
                generation,
            })
            .unwrap();
            sqlx::query("INSERT INTO storage_binding(singleton,firm_id,store_id,generation) VALUES(true,$1,$2,$3)")
                .bind(firm).bind(store_id).bind(generation).execute(&owner).await.unwrap();
        }
        Self {
            admin,
            database,
            role,
            owner,
            worker,
            firm,
            root,
            content,
            binding_file,
            owner_url_file,
            worker_url,
            password,
        }
    }

    pub fn worker_role(&self) -> &str {
        &self.role
    }

    // The assertion task is reaped before cleanup, including a panic. Each test owns different
    // databases, roles, directories and storage bindings; no shared environment mutation/lock.
    pub async fn check<F>(self, body: F)
    where
        F: Future<Output = ()> + Send + 'static,
    {
        let result = tokio::spawn(body).await;
        self.worker.close().await;
        self.owner.close().await;
        // The stored identifiers were generated above, never supplied by the test endpoint.
        sqlx::query(sqlx::AssertSqlSafe(format!(
            "DROP DATABASE {} WITH (FORCE)",
            self.database
        )))
        .execute(&self.admin)
        .await
        .unwrap();
        sqlx::query(sqlx::AssertSqlSafe(format!(
            "DROP ROLE IF EXISTS {}_consumer",
            self.role
        )))
        .execute(&self.admin)
        .await
        .unwrap();
        sqlx::query(sqlx::AssertSqlSafe(format!("DROP ROLE {}", self.role)))
            .execute(&self.admin)
            .await
            .unwrap();
        self.admin.close().await;
        if result.is_ok() {
            std::fs::remove_dir_all(self.root).unwrap();
        }
        result.expect("resource contract assertion failed; private fixture evidence retained");
    }
}

pub async fn company_fixture() -> Fixture {
    let fixture = Fixture::new(false).await;
    CompanyWorker::migrate(&fixture.owner).await.unwrap();
    fixture
}
