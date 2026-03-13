[2026-03-12 11:19:15 +05]
clear

[2026-03-12 11:23:35 +05]
Context: tekushiy proekt e-commerce apteka s client-side, admin-side, superAdmin-side. Vnedri tekushie izmeneniya v proekt. 1) SuperAdmin: v kartochkax tovarov dobav knopku po udaleniyu i deaktivacii tovarov (takje dobavit polnoe udalenie so vsemi dannimi Medicine ego kartinki iz MinIO i dannie o kartinkax iz Bd). v SuperAdmin-side doljni bit otdelnie interfacy upravleniya=> pharmay+Admin, Medcine, Client dlya kajdogo realizaciya poiska po nazvaniyu u SuperAdmin 2) Zanchi

[2026-03-12 11:25:12 +05]
Context: tekushiy proekt e-commerce apteka s client-side,
  admin-side, superAdmin-side. Vnedri tekushie izmeneniya v
  proekt. 1) SuperAdmin: v kartochkax tovarov dobav knopku po
  udaleniyu i deaktivacii tovarov (takje dobavit polnoe udalenie
  so vsemi dannimi Medicine ego kartinki iz MinIO i dannie o
  kartinkax iz Bd). v SuperAdmin-side doljni bit otdelnie
  interfacy upravleniya=> pharmay+Admin, Medcine, Client dlya
  kajdogo realizaciya poiska po nazvaniyu u SuperAdmin 2) Zanchitelno umenshi 2 bolshie kartochki informacii pro api(token) i  informaciyu o tekusheminterface(eto kasaetsya fronta 2 bolshik tablichki naverxu).

[2026-03-12 11:46:45 +05]
posmotri nechego netrogaya pochemu moy posledniy zapushenniy container zapustilsya no ne rabotaet kak to

[2026-03-12 11:58:20 +05]
posmotri konteyner posledniy zpaushenniy yalla-api pochemu tvoix izmneniya tam net

[2026-03-12 12:05:30 +05]
pishi russkimij bukvami

[2026-03-12 13:38:42 +05]
ontext: tekushiy proekt e-commerce apteka s client-side,
    admin-side, superAdmin-side. Vnedri tekushie izmeneniya v
    proekt. 1) SuperAdmin: v kartochkax tovarov dobav knopku po
    udaleniyu i deaktivacii tovarov (takje dobavit polnoe
  udalenie
    so vsemi dannimi Medicine ego kartinki iz MinIO i dannie o
    kartinkax iz Bd). v SuperAdmin-side doljni bit otdelnie
    interfacy upravleniya=> pharmay+Admin, Medcine, Client dlya
    kajdogo realizaciya poiska po nazvaniyu u SuperAdmin 2)
  Zanchitelno umenshi 2 bolshie kartochki informacii pro
  api(token) i  informaciyu o tekusheminterface(eto kasaetsya
  fronta 2 bolshik tablichki naverxu).

[2026-03-12 14:00:00 +05]
sozday enpoint dlya Admin: 1) dobavlenie offer (kolichsetvo i cenu) ne konkretniy medicine i privyazat ego k nemu soxraniv v bd. ryadom so znachkom YallaPharmacy dobav nazvanie interface(klientskihy, adminskiy, ili SuperADminskiy) . Uberi nijnie 2 bloka pro informaciyu ob interface i Api token. u SuperAdmin v upravlenii lekasrstv umenshi razmer lekarstv ix razmer doljen bit takim je kak u kataloga tovarov u iklienta. Sdelay vid kajdogo interfeysa(klient, admion, superAdmin) specifichney dlya razlichiya

[2026-03-12 14:11:00 +05]
da dlya SuperAdmin neoboxidmo videt vse offeri Medciines v podrovnoy informacii ob medicine, Klient toje doljen videt offeri aptek. a v korzine kak mi zadumivali neobxodimo pokazat v kakoy apteke skolko budet stoit u nas est uje gotovie metodi

[2026-03-12 14:53:04 +05]
prostestiruy vse eti momenti

[2026-03-12 15:08:48 +05]
Dobavit: Ogranichenie i validaciyu nomerat telefona dlya logina i parolya delat takje na urovne fronta dlya bistroti i govorit srazu chto naprimer nujno kak minimum 8 simvolov dlya parolya. Dobavit Oformlenie i Cancel zakaza dlya Clienta - metodi  dlya etogo sushestvuyut

[2026-03-12 15:16:02 +05]
prodolji

[2026-03-12 15:20:08 +05]
dobav dlya admin podtverjdenie perexodov statusov kak uje est v backand (perexod v status sobiraetsya, gotov, i edet) dlya zakazov svoey apteki. a dlya SuperAdmin perexod statusa lyubogo zakaza v Delivered i filtraciya po statusam zakazov.

[2026-03-12 15:26:13 +05]
> docker logs yalla-api
[10:24:29 WRN] Storing keys in a directory '/root/.aspnet/DataProtection-Keys' that may not be persisted outside of the container. Protected data will be unavailable when container is destroyed. For more information go to https://aka.ms/aspnet/dataprotectionwarning
[10:24:29 WRN] No XML encryptor configured. Key {7907a9a7-ebe6-4791-81cf-24de2e75153b} may be persisted to storage in unencrypted form.
[10:24:36 WRN] Failed to determine the https port for redirect.
[10:24:36 INF] HTTP GET /api/medicines responded 200 in 575.9005 ms
[10:24:37 INF] HTTP GET /api/medicines/images/d10d6280-9ca1-47df-97e7-63a4a4393183/content responded 200 in 232.0716 ms
[10:24:37 INF] HTTP GET /api/medicines/images/800023d8-c5d5-4090-9fcb-a7d3bdc2ddbe/content responded 200 in 311.5636 ms
[10:25:11 INF] HTTP POST /api/medicines/search responded 200 in 148.0457 ms
[10:25:17 INF] HTTP POST /api/medicines/search responded 200 in 14.0575 ms
[10:25:24 INF] HTTP GET /api/medicines responded 200 in 9.4490 ms
[10:25:29 INF] HTTP GET /api/basket responded 200 in 117.2599 ms
[10:25:29 WRN] Compiling a query which loads related collections for more than one collection navigation, either via 'Include' or through projection, but no 'QuerySplittingBehavior' has been configured. By default, Entity Framework will use 'QuerySplittingBehavior.SingleQuery', which can potentially result in slow query performance. See https://go.microsoft.com/fwlink/?linkid=2134277 for more information. To identify the query that's triggering this warning call 'ConfigureWarnings(w => w.Throw(RelationalEventId.MultipleCollectionIncludeWarning))'.
[10:25:29 INF] HTTP GET /api/medicines/85376a3c-4673-4db4-8a08-0544b951fab8 responded 200 in 91.0476 ms
[10:25:39 WRN] Compiling a query which loads related collections for more than one collection navigation, either via 'Include' or through projection, but no 'QuerySplittingBehavior' has been configured. By default, Entity Framework will use 'QuerySplittingBehavior.SingleQuery', which can potentially result in slow query performance. See https://go.microsoft.com/fwlink/?linkid=2134277 for more information. To identify the query that's triggering this warning call 'ConfigureWarnings(w => w.Throw(RelationalEventId.MultipleCollectionIncludeWarning))'.
[10:25:39 INF] HTTP POST /api/clients/checkout/preview responded 200 in 86.5358 ms
[10:25:39 ERR] Failed executing DbCommand (6ms) [Parameters=[@p0='?' (DbType = Guid), @p1='?' (DbType = Guid), @p2='?' (DbType = DateTime2), @p3='?', @p4='?', @p5='?' (DbType = Guid), @p6='?', @p7='?', @p8='?' (DbType = DateTime2)], CommandType='Text', CommandTimeout='30']
INSERT INTO checkout_requests (id, client_id, created_at_utc, failure_reason, idempotency_key, order_id, payment_transaction_id, request_hash, updated_at_utc)
VALUES (@p0, @p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8)
RETURNING status;
[10:25:39 ERR] An exception occurred in the database while saving changes for context type 'Yalla.Infrastructure.AppDbContext'.
Microsoft.EntityFrameworkCore.DbUpdateException: An error occurred while saving the entity changes. See the inner exception for details.
 ---> System.ArgumentException: Cannot write DateTime with Kind=UTC to PostgreSQL type 'timestamp without time zone', consider using 'timestamp with time zone'. Note that it's not possible to mix DateTimes with different Kinds in an array, range, or multirange. (Parameter 'value')
   at Npgsql.Internal.Converters.DateTimeConverterResolver`1.Get(DateTime value, Nullable`1 expectedPgTypeId, Boolean validateOnly)
   at Npgsql.Internal.Converters.DateTimeConverterResolver.<>c.<CreateResolver>b__0_0(DateTimeConverterResolver`1 resolver, DateTime value, Nullable`1 expectedPgTypeId)
   at Npgsql.Internal.Converters.DateTimeConverterResolver`1.Get(T value, Nullable`1 expectedPgTypeId)
   at Npgsql.Internal.PgConverterResolver`1.GetAsObjectInternal(PgTypeInfo typeInfo, Object value, Nullable`1 expectedPgTypeId)
   at Npgsql.Internal.PgResolverTypeInfo.GetResolutionAsObject(Object value, Nullable`1 expectedPgTypeId)
   at Npgsql.Internal.PgTypeInfo.GetObjectResolution(Object value)
   at Npgsql.NpgsqlParameter.ResolveConverter(PgTypeInfo typeInfo)
   at Npgsql.NpgsqlParameter.ResolveTypeInfo(PgSerializerOptions options)
   at Npgsql.NpgsqlParameterCollection.ProcessParameters(PgSerializerOptions options, Boolean validateValues, CommandType commandType)
   at Npgsql.NpgsqlCommand.ExecuteReader(Boolean async, CommandBehavior behavior, CancellationToken cancellationToken)
   at Npgsql.NpgsqlCommand.ExecuteReader(Boolean async, CommandBehavior behavior, CancellationToken cancellationToken)
   at Npgsql.NpgsqlCommand.ExecuteDbDataReaderAsync(CommandBehavior behavior, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Storage.RelationalCommand.ExecuteReaderAsync(RelationalCommandParameterObject parameterObject, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Storage.RelationalCommand.ExecuteReaderAsync(RelationalCommandParameterObject parameterObject, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Update.ReaderModificationCommandBatch.ExecuteAsync(IRelationalConnection connection, CancellationToken cancellationToken)
   --- End of inner exception stack trace ---
   at Microsoft.EntityFrameworkCore.Update.ReaderModificationCommandBatch.ExecuteAsync(IRelationalConnection connection, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Update.Internal.BatchExecutor.ExecuteAsync(IEnumerable`1 commandBatches, IRelationalConnection connection, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Update.Internal.BatchExecutor.ExecuteAsync(IEnumerable`1 commandBatches, IRelationalConnection connection, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Update.Internal.BatchExecutor.ExecuteAsync(IEnumerable`1 commandBatches, IRelationalConnection connection, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Storage.RelationalDatabase.SaveChangesAsync(IList`1 entries, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.ChangeTracking.Internal.StateManager.SaveChangesAsync(IList`1 entriesToSave, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.ChangeTracking.Internal.StateManager.SaveChangesAsync(StateManager stateManager, Boolean acceptAllChangesOnSuccess, CancellationToken cancellationToken)
   at Npgsql.EntityFrameworkCore.PostgreSQL.Storage.Internal.NpgsqlExecutionStrategy.ExecuteAsync[TState,TResult](TState state, Func`4 operation, Func`4 verifySucceeded, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.DbContext.SaveChangesAsync(Boolean acceptAllChangesOnSuccess, CancellationToken cancellationToken)
Microsoft.EntityFrameworkCore.DbUpdateException: An error occurred while saving the entity changes. See the inner exception for details.
 ---> System.ArgumentException: Cannot write DateTime with Kind=UTC to PostgreSQL type 'timestamp without time zone', consider using 'timestamp with time zone'. Note that it's not possible to mix DateTimes with different Kinds in an array, range, or multirange. (Parameter 'value')
   at Npgsql.Internal.Converters.DateTimeConverterResolver`1.Get(DateTime value, Nullable`1 expectedPgTypeId, Boolean validateOnly)
   at Npgsql.Internal.Converters.DateTimeConverterResolver.<>c.<CreateResolver>b__0_0(DateTimeConverterResolver`1 resolver, DateTime value, Nullable`1 expectedPgTypeId)
   at Npgsql.Internal.Converters.DateTimeConverterResolver`1.Get(T value, Nullable`1 expectedPgTypeId)
   at Npgsql.Internal.PgConverterResolver`1.GetAsObjectInternal(PgTypeInfo typeInfo, Object value, Nullable`1 expectedPgTypeId)
   at Npgsql.Internal.PgResolverTypeInfo.GetResolutionAsObject(Object value, Nullable`1 expectedPgTypeId)
   at Npgsql.Internal.PgTypeInfo.GetObjectResolution(Object value)
   at Npgsql.NpgsqlParameter.ResolveConverter(PgTypeInfo typeInfo)
   at Npgsql.NpgsqlParameter.ResolveTypeInfo(PgSerializerOptions options)
   at Npgsql.NpgsqlParameterCollection.ProcessParameters(PgSerializerOptions options, Boolean validateValues, CommandType commandType)
   at Npgsql.NpgsqlCommand.ExecuteReader(Boolean async, CommandBehavior behavior, CancellationToken cancellationToken)
   at Npgsql.NpgsqlCommand.ExecuteReader(Boolean async, CommandBehavior behavior, CancellationToken cancellationToken)
   at Npgsql.NpgsqlCommand.ExecuteDbDataReaderAsync(CommandBehavior behavior, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Storage.RelationalCommand.ExecuteReaderAsync(RelationalCommandParameterObject parameterObject, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Storage.RelationalCommand.ExecuteReaderAsync(RelationalCommandParameterObject parameterObject, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Update.ReaderModificationCommandBatch.ExecuteAsync(IRelationalConnection connection, CancellationToken cancellationToken)
   --- End of inner exception stack trace ---
   at Microsoft.EntityFrameworkCore.Update.ReaderModificationCommandBatch.ExecuteAsync(IRelationalConnection connection, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Update.Internal.BatchExecutor.ExecuteAsync(IEnumerable`1 commandBatches, IRelationalConnection connection, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Update.Internal.BatchExecutor.ExecuteAsync(IEnumerable`1 commandBatches, IRelationalConnection connection, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Update.Internal.BatchExecutor.ExecuteAsync(IEnumerable`1 commandBatches, IRelationalConnection connection, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.Storage.RelationalDatabase.SaveChangesAsync(IList`1 entries, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.ChangeTracking.Internal.StateManager.SaveChangesAsync(IList`1 entriesToSave, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.ChangeTracking.Internal.StateManager.SaveChangesAsync(StateManager stateManager, Boolean acceptAllChangesOnSuccess, CancellationToken cancellationToken)
   at Npgsql.EntityFrameworkCore.PostgreSQL.Storage.Internal.NpgsqlExecutionStrategy.ExecuteAsync[TState,TResult](TState state, Func`4 operation, Func`4 verifySucceeded, CancellationToken cancellationToken)
   at Microsoft.EntityFrameworkCore.DbContext.SaveChangesAsync(Boolean acceptAllChangesOnSuccess, CancellationToken cancellationToken)
[10:25:39 WRN] Handled exception for POST /api/clients/checkout. TraceId: 0HNK0467JUFE1:00000009. StatusCode: 400. ErrorCode: invalid_operation. ExceptionType: InvalidOperationException
[10:25:39 INF] HTTP POST /api/clients/checkout responded 400 in 234.8946 ms
~                                                                                                                                                      15:25:49
> chto znachit eta oshibka pri oformlenii zakaza

[2026-03-12 15:34:44 +05]
tekushie oshibki posle oformleniya nevischitivaetsya stoimost zakaza v istorii i pokazivaetsya vsegda 0, postav na urvone back i front ograncheniya chtob nelzvya bilo perevesti zakaza na stage nazad ili pereprignut stage

[2026-03-12 15:40:47 +05]
clear

[2026-03-12 15:42:36 +05]
proskaniruy servisi po oformleniyu zakaza na korrektnost

