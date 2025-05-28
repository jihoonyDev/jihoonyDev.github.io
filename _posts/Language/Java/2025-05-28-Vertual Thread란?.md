---
layout: post
title: "Vertual Thread란?"
date: 2025-05-28
categories: ["Language/Java"]
excerpt: "Java 19의 Virtual Thread로 가벼운 동시성 프로그래밍과 대규모 I/O 처리가 가능해졌습니다."
---
Virtual Thread는 Java 19에서 도입된 새로운 형태의 스레드입니다. 기존의 플랫폼 스레드(Platform Thread)와 달리, JVM에 의해 관리되는 경량 스레드로, 운영체제 스레드와 1:1로 매핑되지 않습니다.

## 역사적 배경과 등장 이유

Java의 동시성 프로그래밍은 오랫동안 다음과 같은 딜레마에 직면해 있었습니다:

1. **Thread-per-request 모델의 한계**: 웹 서버에서 요청마다 스레드를 생성하는 방식은 직관적이지만, 스레드 수 제한으로 인해 확장성에 문제가 있었습니다.

2. **비동기 프로그래밍의 복잡성**: CompletableFuture, Reactive Streams 등의 비동기 API는 성능은 좋지만 코드가 복잡하고 디버깅이 어려웠습니다.

3. **Go언어의 goroutine, Erlang의 actor 모델**: 다른 언어들이 경량 스레드로 성공을 거두면서 Java도 이에 대한 해답이 필요했습니다.

Virtual Thread는 이러한 문제들을 해결하기 위해 **Project Loom**의 일환으로 개발되었습니다.

## 기존 플랫폼 스레드의 한계

### 메모리 관점
- **높은 메모리 사용량**: 각 스레드마다 약 2MB의 스택 메모리 필요
- **메타데이터 오버헤드**: 스레드 컨텍스트, 레지스터 상태 등 추가 메모리 필요
- **메모리 단편화**: 스레드 스택이 연속된 메모리 공간을 차지하여 단편화 발생

### 성능 관점
- **생성 비용**: OS 스레드 생성/삭제에 따른 시스템 콜 오버헤드
- **컨텍스트 스위칭 비용**: 스레드 간 전환 시 발생하는 성능 손실 (수십 마이크로초)
- **스케줄링 오버헤드**: OS 커널 레벨에서의 스케줄링 부담

### 확장성 관점
- **제한된 스레드 수**: 일반적으로 수천 개 스레드가 한계
- **C10K 문제**: 10,000개 동시 연결 처리의 어려움
- **리소스 경합**: 많은 스레드로 인한 락 경합 증가

## Virtual Thread의 특징

### 1. 경량성 (Lightweight)
```java
// Virtual Thread의 메모리 사용량 비교
public class MemoryComparison {
    public static void main(String[] args) throws InterruptedException {
        Runtime runtime = Runtime.getRuntime();
        
        // 메모리 측정 전 GC 실행
        System.gc();
        long beforeMemory = runtime.totalMemory() - runtime.freeMemory();
        
        // 100,000개 Virtual Thread 생성
        CountDownLatch latch = new CountDownLatch(100_000);
        for (int i = 0; i < 100_000; i++) {
            Thread.startVirtualThread(() -> {
                try {
                    Thread.sleep(Duration.ofSeconds(10)); // 10초 대기
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    latch.countDown();
                }
            });
        }
        
        // 메모리 사용량 측정
        System.gc();
        long afterMemory = runtime.totalMemory() - runtime.freeMemory();
        long usedMemory = (afterMemory - beforeMemory) / 1024 / 1024;
        
        System.out.println("100,000개 Virtual Thread 메모리 사용량: " + usedMemory + "MB");
        // 일반적으로 수십 MB 정도만 사용
        
        latch.await();
    }
}
```

- **스택 크기**: 초기 수 KB에서 시작하여 필요에 따라 동적 확장
- **힙 기반 스택**: 연속된 메모리가 아닌 힙에 청크 단위로 할당
- **메모리 효율성**: 수백만 개의 Virtual Thread 생성 가능

### 2. JVM 관리 (JVM-managed)
```java
// Virtual Thread의 내부 동작 확인
public class VirtualThreadInternals {
    public static void main(String[] args) throws InterruptedException {
        Thread.startVirtualThread(() -> {
            System.out.println("Virtual Thread: " + Thread.currentThread());
            System.out.println("Is Virtual: " + Thread.currentThread().isVirtual());
            System.out.println("Thread ID: " + Thread.currentThread().threadId());
            
            try {
                // I/O 작업 시뮬레이션
                Thread.sleep(1000);
                System.out.println("After sleep: " + Thread.currentThread());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        });
        
        Thread.sleep(2000);
    }
}
```

- **Carrier Thread**: Virtual Thread를 실행하는 실제 플랫폼 스레드
- **Mount/Unmount**: I/O 대기 시 Carrier Thread에서 분리되어 다른 Virtual Thread가 사용 가능
- **Work-stealing**: ForkJoinPool 기반의 효율적인 작업 분배

### 3. 블로킹 I/O 최적화
```java
// 블로킹 I/O에서의 Virtual Thread 동작
public class BlockingIOExample {
    public static void main(String[] args) throws InterruptedException {
        ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor();
        
        // 1000개의 HTTP 요청을 동시에 처리
        List<CompletableFuture<String>> futures = IntStream.range(0, 1000)
            .mapToObj(i -> CompletableFuture.supplyAsync(() -> {
                try {
                    // 각 요청이 1초씩 걸린다고 가정
                    URL url = new URL("https://httpbin.org/delay/1");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("GET");
                    conn.setConnectTimeout(5000);
                    conn.setReadTimeout(10000);
                    
                    int responseCode = conn.getResponseCode();
                    return "Request " + i + ": " + responseCode;
                } catch (Exception e) {
                    return "Request " + i + ": Error - " + e.getMessage();
                }
            }, executor))
            .collect(Collectors.toList());
        
        // 모든 요청이 약 1초 만에 완료됨 (순차 처리 시 1000초 소요)
        long start = System.currentTimeMillis();
        futures.forEach(future -> {
            try {
                System.out.println(future.get());
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
        long end = System.currentTimeMillis();
        
        System.out.println("Total time: " + (end - start) + "ms");
        executor.shutdown();
    }
}
```

## Virtual Thread의 내부 동작 원리

### 1. Continuation과 Scheduler

Virtual Thread는 내부적으로 **Continuation**과 **Scheduler**라는 두 가지 핵심 개념을 사용합니다:

```java
// Continuation의 개념적 이해를 위한 예시
public class ContinuationConcept {
    public static void main(String[] args) {
        Thread.startVirtualThread(() -> {
            System.out.println("1. 작업 시작");
            
            try {
                // 이 지점에서 Continuation이 저장됨
                Thread.sleep(1000); // I/O 시뮬레이션
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            
            // sleep 완료 후 Continuation에서 재개됨
            System.out.println("2. 작업 재개");
            System.out.println("3. 작업 완료");
        });
    }
}
```

### Continuation
- **정의**: 프로그램의 실행 상태를 저장하고 나중에 재개할 수 있는 메커니즘
- **역할**: Virtual Thread가 블로킹될 때 현재 실행 상태를 저장
- **구현**: 스택 프레임, 로컬 변수, 프로그램 카운터 등을 힙에 저장

### Scheduler
- **ForkJoinPool 기반**: 기본적으로 `ForkJoinPool.commonPool()` 사용
- **Work-stealing**: 유휴 스레드가 다른 스레드의 작업을 가져와 실행
- **적응적 스케줄링**: CPU 코어 수에 따라 Carrier Thread 수 조정

## 2. Mount/Unmount 과정

```java
// Mount/Unmount 과정 시각화
public class MountUnmountDemo {
    public static void main(String[] args) throws InterruptedException {
        System.out.println("Available processors: " + 
            Runtime.getRuntime().availableProcessors());
        
        // 많은 Virtual Thread 생성하여 Mount/Unmount 관찰
        for (int i = 0; i < 20; i++) {
            final int threadNum = i;
            Thread.startVirtualThread(() -> {
                System.out.println("Thread " + threadNum + 
                    " started on carrier: " + getCarrierThreadName());
                
                try {
                    Thread.sleep(100); // Unmount 발생
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                
                System.out.println("Thread " + threadNum + 
                    " resumed on carrier: " + getCarrierThreadName());
            });
        }
        
        Thread.sleep(1000);
    }
    
    private static String getCarrierThreadName() {
        // Virtual Thread의 Carrier Thread 정보는 내부 API로만 접근 가능
        // 여기서는 개념적 설명을 위한 예시
        return Thread.currentThread().toString();
    }
}
```

# Virtual Thread 사용 예시

## 1. 기본 생성 및 실행

```java
public class VirtualThreadBasic {
    public static void main(String[] args) throws InterruptedException {
        // Virtual Thread 생성 방법 1: Thread.ofVirtual()
        Thread virtualThread = Thread.ofVirtual()
            .name("virtual-thread-1")
            .start(() -> {
                System.out.println("Hello from " + Thread.currentThread());
                System.out.println("Is virtual: " + Thread.currentThread().isVirtual());
            });
        
        virtualThread.join();
        
        // Virtual Thread 생성 방법 2: Thread.startVirtualThread()
        Thread.startVirtualThread(() -> {
            System.out.println("Hello from " + Thread.currentThread());
        });
        
        // Virtual Thread 생성 방법 3: Thread.ofVirtual().factory()
        ThreadFactory factory = Thread.ofVirtual()
            .name("worker-", 0)
            .factory();
        
        Thread worker1 = factory.newThread(() -> 
            System.out.println("Worker thread: " + Thread.currentThread()));
        Thread worker2 = factory.newThread(() -> 
            System.out.println("Worker thread: " + Thread.currentThread()));
        
        worker1.start();
        worker2.start();
        
        worker1.join();
        worker2.join();
        
        Thread.sleep(1000); // 완료 대기
    }
}
```

## 2. 웹 서버 시뮬레이션

```java
import java.io.*;
import java.net.*;
import java.util.concurrent.*;

public class VirtualThreadWebServer {
    private static final int PORT = 8080;
    private static final ExecutorService executor = 
        Executors.newVirtualThreadPerTaskExecutor();
    
    public static void main(String[] args) throws IOException {
        try (ServerSocket serverSocket = new ServerSocket(PORT)) {
            System.out.println("Virtual Thread Web Server started on port " + PORT);
            
            while (true) {
                Socket clientSocket = serverSocket.accept();
                
                // 각 클라이언트 요청을 Virtual Thread로 처리
                executor.submit(() -> handleClient(clientSocket));
            }
        }
    }
    
    private static void handleClient(Socket clientSocket) {
        try (BufferedReader in = new BufferedReader(
                new InputStreamReader(clientSocket.getInputStream()));
             PrintWriter out = new PrintWriter(
                clientSocket.getOutputStream(), true)) {
            
            String inputLine;
            StringBuilder request = new StringBuilder();
            
            // HTTP 요청 읽기
            while ((inputLine = in.readLine()) != null) {
                request.append(inputLine).append("\n");
                if (inputLine.isEmpty()) break;
            }
            
            System.out.println("Request handled by: " + Thread.currentThread());
            
            // 데이터베이스 조회 시뮬레이션 (I/O 블로킹)
            simulateDBQuery();
            
            // HTTP 응답 전송
            String response = "HTTP/1.1 200 OK\r\n" +
                            "Content-Type: text/html\r\n" +
                            "Content-Length: 45\r\n" +
                            "\r\n" +
                            "<html><body><h1>Hello World!</h1></body></html>";
            
            out.print(response);
            out.flush();
            
        } catch (IOException e) {
            System.err.println("Error handling client: " + e.getMessage());
        } finally {
            try {
                clientSocket.close();
            } catch (IOException e) {
                System.err.println("Error closing client socket: " + e.getMessage());
            }
        }
    }
    
    private static void simulateDBQuery() {
        try {
            // 데이터베이스 쿼리 시뮬레이션 (100ms 소요)
            Thread.sleep(100);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
```

## 3. 대량 데이터 처리

```java
import java.util.concurrent.*;
import java.util.stream.*;
import java.util.*;

public class MassiveDataProcessing {
    public static void main(String[] args) throws InterruptedException {
        // 100만 개의 데이터 처리 시뮬레이션
        List<Integer> data = IntStream.range(0, 1_000_000)
            .boxed()
            .collect(Collectors.toList());
        
        System.out.println("Processing " + data.size() + " items...");
        
        long start = System.currentTimeMillis();
        
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            
            // 각 데이터를 Virtual Thread로 병렬 처리
            List<CompletableFuture<String>> futures = data.stream()
                .map(item -> CompletableFuture.supplyAsync(() -> {
                    return processItem(item);
                }, executor))
                .collect(Collectors.toList());
            
            // 모든 작업 완료 대기
            CompletableFuture<Void> allOf = CompletableFuture.allOf(
                futures.toArray(new CompletableFuture[0]));
            
            allOf.join();
            
            long end = System.currentTimeMillis();
            System.out.println("Processing completed in: " + (end - start) + "ms");
            
            // 결과 수집 (선택적)
            List<String> results = futures.stream()
                .map(CompletableFuture::join)
                .limit(10) // 처음 10개만 출력
                .collect(Collectors.toList());
            
            System.out.println("Sample results: " + results);
        }
    }
    
    private static String processItem(Integer item) {
        try {
            // 복잡한 처리 시뮬레이션 (I/O 포함)
            Thread.sleep(1); // 1ms 처리 시간
            
            // 실제로는 데이터베이스 조회, API 호출, 파일 처리 등
            return "Processed: " + item + " -> " + (item * item);
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return "Error processing: " + item;
        }
    }
}
```

## 4. 실시간 데이터 스트리밍

```java
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.time.*;

public class RealTimeDataStreaming {
    private static final AtomicLong messageCount = new AtomicLong(0);
    private static final AtomicLong processedCount = new AtomicLong(0);
    
    public static void main(String[] args) throws InterruptedException {
        BlockingQueue<String> messageQueue = new LinkedBlockingQueue<>();
        
        // 메시지 생산자 (데이터 소스 시뮬레이션)
        Thread.startVirtualThread(() -> produceMessages(messageQueue));
        
        // 메시지 소비자들 (1000개의 Virtual Thread로 처리)
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            
            for (int i = 0; i < 1000; i++) {
                executor.submit(() -> consumeMessages(messageQueue));
            }
            
            // 통계 출력
            Thread.startVirtualThread(() -> printStats());
            
            // 10초간 실행
            Thread.sleep(10_000);
            
            System.out.println("Shutting down...");
        }
        
        System.out.println("Final stats:");
        System.out.println("Messages produced: " + messageCount.get());
        System.out.println("Messages processed: " + processedCount.get());
    }
    
    private static void produceMessages(BlockingQueue<String> queue) {
        try {
            while (!Thread.currentThread().isInterrupted()) {
                String message = "Message-" + messageCount.incrementAndGet() + 
                               "-" + Instant.now();
                queue.offer(message);
                Thread.sleep(1); // 1ms마다 메시지 생성
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
    
    private static void consumeMessages(BlockingQueue<String> queue) {
        try {
            while (!Thread.currentThread().isInterrupted()) {
                String message = queue.poll(100, TimeUnit.MILLISECONDS);
                if (message != null) {
                    processMessage(message);
                    processedCount.incrementAndGet();
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
    
    private static void processMessage(String message) {
        try {
            // 메시지 처리 시뮬레이션 (I/O 작업 포함)
            Thread.sleep(10); // 10ms 처리 시간
            
            // 실제로는 데이터 변환, 저장, 전송 등의 작업
            if (message.contains("1000")) {
                System.out.println("Processed milestone: " + message);
            }
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
    
    private static void printStats() {
        try {
            while (!Thread.currentThread().isInterrupted()) {
                Thread.sleep(1000); // 1초마다 통계 출력
                System.out.printf("Produced: %d, Processed: %d, Queue size: %d%n",
                    messageCount.get(), processedCount.get(), 
                    messageCount.get() - processedCount.get());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
```

# Virtual Thread 사용 시 주의사항

## 1. CPU 집약적 작업에는 부적합

```java
// CPU 집약적 작업에서의 성능 비교
public class CPUIntensiveComparison {
    public static void main(String[] args) throws InterruptedException {
        int taskCount = 1000;
        
        // CPU 집약적 작업 (소수 계산)
        Runnable cpuTask = () -> {
            long result = 0;
            for (int i = 0; i < 1_000_000; i++) {
                result += isPrime(i) ? 1 : 0;
            }
            System.out.println("Found primes: " + result);
        };
        
        // Platform Thread Pool 테스트
        long platformTime = measureTime(() -> {
            try (ExecutorService executor = Executors.newFixedThreadPool(
                    Runtime.getRuntime().availableProcessors())) {
                for (int i = 0; i < taskCount; i++) {
                    executor.submit(cpuTask);
                }
            }
        });
        
        // Virtual Thread 테스트
        long virtualTime = measureTime(() -> {
            try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
                for (int i = 0; i < taskCount; i++) {
                    executor.submit(cpuTask);
                }
            }
        });
        
        System.out.println("Platform Threads: " + platformTime + "ms");
        System.out.println("Virtual Threads: " + virtualTime + "ms");
        System.out.println("CPU 집약적 작업에서는 Platform Thread가 더 효율적일 수 있음");
    }
    
    private static boolean isPrime(int n) {
        if (n < 2) return false;
        for (int i = 2; i <= Math.sqrt(n); i++) {
            if (n % i == 0) return false;
        }
        return true;
    }
    
    private static long measureTime(Runnable task) {
        long start = System.currentTimeMillis();
        task.run();
        return System.currentTimeMillis() - start;
    }
}
```

**권장사항**: CPU 집약적 작업의 경우 `ForkJoinPool`이나 CPU 코어 수만큼의 플랫폼 스레드 풀을 사용하는 것이 좋습니다.

## 2. Pinning 문제와 해결책

```java
import java.util.concurrent.locks.*;

public class PinningProblem {
    private static final Object syncLock = new Object();
    private static final ReentrantLock reentrantLock = new ReentrantLock();
    
    public static void main(String[] args) throws InterruptedException {
        System.out.println("=== Pinning 문제 시연 ===");
        
        // 문제가 되는 코드: synchronized 블록 내에서 블로킹
        Thread.startVirtualThread(() -> {
            synchronized (syncLock) {
                System.out.println("Synchronized 블록 진입");
                try {
                    Thread.sleep(1000); // 이 시점에서 Pinning 발생!
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                System.out.println("Synchronized 블록 종료");
            }
        });
        
        // 해결책: ReentrantLock 사용
        Thread.startVirtualThread(() -> {
            reentrantLock.lock();
            try {
                System.out.println("ReentrantLock 획득");
                Thread.sleep(1000); // Pinning 발생하지 않음
                System.out.println("ReentrantLock 해제");
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } finally {
                reentrantLock.unlock();
            }
        });
        
        Thread.sleep(2000);
    }
}
```

**Pinning이 발생하는 상황들:**
- `synchronized` 블록/메서드 내에서 블로킹 작업
- JNI(Java Native Interface) 호출
- `Object.wait()` 호출

**해결책:**
- `synchronized` 대신 `ReentrantLock` 사용
- JNI 호출 최소화
- `Object.wait()` 대신 `LockSupport.park()` 사용

## 3. ThreadLocal 사용 주의사항

```java
public class ThreadLocalIssue {
    // 문제가 될 수 있는 ThreadLocal 사용
    private static final ThreadLocal<ExpensiveResource> threadLocal = 
        ThreadLocal.withInitial(ExpensiveResource::new);
    
    // 개선된 방법: ScopedValue 사용 (Java 20+)
    // private static final ScopedValue<ExpensiveResource> scopedValue = 
    //     ScopedValue.newInstance();
    
    public static void main(String[] args) throws InterruptedException {
        System.out.println("=== ThreadLocal 메모리 사용량 테스트 ===");
        
        // 대량의 Virtual Thread에서 ThreadLocal 사용
        CountDownLatch latch = new CountDownLatch(100_000);
        
        for (int i = 0; i < 100_000; i++) {
            Thread.startVirtualThread(() -> {
                try {
                    // ThreadLocal 값 사용
                    ExpensiveResource resource = threadLocal.get();
                    resource.doSomething();
                    
                    Thread.sleep(100); // 잠시 대기
                    
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    // 중요: ThreadLocal 정리
                    threadLocal.remove();
                    latch.countDown();
                }
            });
        }
        
        latch.await();
        System.out.println("모든 Virtual Thread 완료");
        
        // 메모리 사용량 확인
        System.gc();
        Runtime runtime = Runtime.getRuntime();
        long usedMemory = (runtime.totalMemory() - runtime.freeMemory()) / 1024 / 1024;
        System.out.println("메모리 사용량: " + usedMemory + "MB");
    }
    
    static class ExpensiveResource {
        private final byte[] data = new byte[1024]; // 1KB 데이터
        
        public void doSomething() {
            // 리소스 사용 시뮬레이션
        }
    }
}
```

**ThreadLocal 사용 시 주의사항:**
- Virtual Thread는 수가 매우 많을 수 있어 메모리 누수 위험
- 반드시 `ThreadLocal.remove()` 호출
- 가능하면 `ScopedValue` 사용 고려 (Java 20+)

## 4. 모니터링과 디버깅

```java
import java.lang.management.*;

public class VirtualThreadMonitoring {
    public static void main(String[] args) throws InterruptedException {
        ThreadMXBean threadMX = ManagementFactory.getThreadMXBean();
        
        System.out.println("=== Virtual Thread 모니터링 ===");
        
        // 초기 스레드 수
        System.out.println("초기 스레드 수: " + threadMX.getThreadCount());
        
        // 대량의 Virtual Thread 생성
        CountDownLatch latch = new CountDownLatch(10_000);
        
        for (int i = 0; i < 10_000; i++) {
            Thread.startVirtualThread(() -> {
                try {
                    Thread.sleep(5000); // 5초 대기
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                } finally {
                    latch.countDown();
                }
            });
        }
        
        // 스레드 수 변화 모니터링
        for (int i = 0; i < 10; i++) {
            Thread.sleep(1000);
            System.out.println("현재 스레드 수: " + threadMX.getThreadCount());
            
            // 메모리 사용량
            Runtime runtime = Runtime.getRuntime();
            long usedMemory = (runtime.totalMemory() - runtime.freeMemory()) / 1024 / 1024;
            System.out.println("메모리 사용량: " + usedMemory + "MB");
        }
        
        latch.await();
        System.out.println("모든 Virtual Thread 완료");
        System.out.println("최종 스레드 수: " + threadMX.getThreadCount());
    }
}
```

**모니터링 도구:**
- JVM 플래그: `-Djdk.tracePinnedThreads=full` (Pinning 감지)
- JFR(Java Flight Recorder): Virtual Thread 이벤트 추적
- VisualVM, JProfiler 등의 프로파일링 도구

# 실제 프로덕션 환경에서의 고려사항

## 1. 점진적 도입 전략

```java
// 기존 코드와의 호환성을 위한 점진적 도입
public class GradualAdoption {
    
    // 기존 방식: 플랫폼 스레드 풀
    private static final ExecutorService legacyExecutor = 
        Executors.newFixedThreadPool(100);
    
    // 새로운 방식: Virtual Thread
    private static final ExecutorService virtualExecutor = 
        Executors.newVirtualThreadPerTaskExecutor();
    
    public static void main(String[] args) {
        // 설정을 통한 선택적 사용
        boolean useVirtualThreads = Boolean.parseBoolean(
            System.getProperty("use.virtual.threads", "false"));
        
        ExecutorService executor = useVirtualThreads ? 
            virtualExecutor : legacyExecutor;
        
        // 동일한 코드로 두 방식 모두 지원
        for (int i = 0; i < 1000; i++) {
            final int taskId = i;
            executor.submit(() -> {
                processTask(taskId);
            });
        }
        
        // 적절한 종료 처리
        executor.shutdown();
    }
    
    private static void processTask(int taskId) {
        try {
            // 실제 비즈니스 로직
            Thread.sleep(100);
            System.out.println("Task " + taskId + " completed by " + 
                Thread.currentThread());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
```

## 2. 성능 테스트와 벤치마킹

```java
import java.util.concurrent.atomic.*;

public class ProductionBenchmark {
    private static final AtomicLong requestCount = new AtomicLong(0);
    private static final AtomicLong responseTime = new AtomicLong(0);
    
    public static void main(String[] args) throws InterruptedException {
        System.out.println("=== 프로덕션 환경 벤치마크 ===");
        
        // 실제 워크로드 시뮬레이션
        int concurrentUsers = 10_000;
        int requestsPerUser = 10;
        
        long start = System.currentTimeMillis();
        
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            
            CountDownLatch latch = new CountDownLatch(concurrentUsers);
            
            for (int i = 0; i < concurrentUsers; i++) {
                executor.submit(() -> {
                    try {
                        simulateUserSession(requestsPerUser);
                    } finally {
                        latch.countDown();
                    }
                });
            }
            
            latch.await();
        }
        
        long end = System.currentTimeMillis();
        long totalTime = end - start;
        
        System.out.println("=== 벤치마크 결과 ===");
        System.out.println("총 요청 수: " + requestCount.get());
        System.out.println("총 소요 시간: " + totalTime + "ms");
        System.out.println("평균 응답 시간: " + (responseTime.get() / requestCount.get()) + "ms");
        System.out.println("처리량: " + (requestCount.get() * 1000 / totalTime) + " req/sec");
    }
    
    private static void simulateUserSession(int requestsPerUser) {
        for (int i = 0; i < requestsPerUser; i++) {
            long requestStart = System.currentTimeMillis();
            
            try {
                // 실제 비즈니스 로직 시뮬레이션
                simulateDBQuery();      // 50ms
                simulateAPICall();      // 100ms
                simulateProcessing();   // 30ms
                
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
            
            long requestEnd = System.currentTimeMillis();
            requestCount.incrementAndGet();
            responseTime.addAndGet(requestEnd - requestStart);
        }
    }
    
    private static void simulateDBQuery() throws InterruptedException {
        Thread.sleep(50); // 데이터베이스 쿼리 시뮬레이션
    }
    
    private static void simulateAPICall() throws InterruptedException {
        Thread.sleep(100); // 외부 API 호출 시뮬레이션
    }
    
    private static void simulateProcessing() throws InterruptedException {
        Thread.sleep(30); // 비즈니스 로직 처리 시뮬레이션
    }
}
```

## 3. 에러 처리와 복구

```java
public class ErrorHandlingBestPractices {
    private static final AtomicInteger errorCount = new AtomicInteger(0);
    
    public static void main(String[] args) throws InterruptedException {
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            
            // 에러 처리를 포함한 안정적인 Virtual Thread 사용
            for (int i = 0; i < 1000; i++) {
                final int taskId = i;
                executor.submit(() -> {
                    try {
                        processTaskWithErrorHandling(taskId);
                    } catch (Exception e) {
                        handleError(taskId, e);
                    }
                });
            }
            
            Thread.sleep(5000); // 작업 완료 대기
        }
        
        System.out.println("총 에러 수: " + errorCount.get());
    }
    
    private static void processTaskWithErrorHandling(int taskId) throws Exception {
        try {
            // 실제 작업 수행
            if (taskId % 100 == 0) {
                throw new RuntimeException("Simulated error for task " + taskId);
            }
            
            Thread.sleep(10); // 정상 처리
            System.out.println("Task " + taskId + " completed successfully");
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new Exception("Task interrupted", e);
        }
    }
    
    private static void handleError(int taskId, Exception e) {
        errorCount.incrementAndGet();
        
        // 로깅
        System.err.println("Error in task " + taskId + ": " + e.getMessage());
        
        // 에러 메트릭 수집
        // metrics.incrementCounter("task.errors");
        
        // 필요시 재시도 로직
        // retryTask(taskId);
        
        // 알림 발송 (심각한 에러의 경우)
        if (errorCount.get() > 100) {
            System.err.println("WARNING: High error rate detected!");
        }
    }
}
```

# Spring Framework와의 통합

```java
// Spring Boot에서 Virtual Thread 사용 예시
@Configuration
@EnableAsync
public class VirtualThreadConfig {
    
    @Bean
    @Primary
    public Executor taskExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }
    
    @Bean
    public TaskExecutor virtualThreadTaskExecutor() {
        return new TaskExecutorAdapter(Executors.newVirtualThreadPerTaskExecutor());
    }
}

@Service
public class AsyncService {
    
    @Async
    public CompletableFuture<String> processAsync(String data) {
        try {
            // I/O 집약적 작업
            Thread.sleep(1000);
            return CompletableFuture.completedFuture("Processed: " + data);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return CompletableFuture.failedFuture(e);
        }
    }
}

@RestController
public class VirtualThreadController {
    
    @Autowired
    private AsyncService asyncService;
    
    @GetMapping("/process/{data}")
    public CompletableFuture<String> processData(@PathVariable String data) {
        // 이 메서드는 Virtual Thread에서 실행됨
        return asyncService.processAsync(data);
    }
}
```

# 성능 비교

```java
public class PerformanceComparison {
    public static void main(String[] args) throws InterruptedException {
        int taskCount = 10_000;
        
        // 플랫폼 스레드 풀 사용
        long platformTime = measurePlatformThreads(taskCount);
        
        // Virtual Thread 사용
        long virtualTime = measureVirtualThreads(taskCount);
        
        System.out.println("Platform Threads: " + platformTime + "ms");
        System.out.println("Virtual Threads: " + virtualTime + "ms");
        System.out.println("Virtual Thread가 " + (platformTime / (double) virtualTime) + "배 빠름");
    }
    
    private static long measurePlatformThreads(int taskCount) throws InterruptedException {
        try (ExecutorService executor = Executors.newFixedThreadPool(200)) {
            return measureExecution(executor, taskCount);
        }
    }
    
    private static long measureVirtualThreads(int taskCount) throws InterruptedException {
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            return measureExecution(executor, taskCount);
        }
    }
    
    private static long measureExecution(ExecutorService executor, int taskCount) 
            throws InterruptedException {
        long start = System.currentTimeMillis();
        
        for (int i = 0; i < taskCount; i++) {
            executor.submit(() -> {
                try {
                    Thread.sleep(10); // I/O 작업 시뮬레이션
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            });
        }
        
        executor.shutdown();
        executor.awaitTermination(1, java.util.concurrent.TimeUnit.MINUTES);
        
        return System.currentTimeMillis() - start;
    }
}
```

## 실행 결과

**테스트 환경:**
- CPU: Apple M 시리즈 (10코어)
- RAM: 4GB 할당
- JVM: OpenJDK 21.0.2
- OS: macOS 15.5

**10,000개 작업 (각 10ms 대기) 실행 결과:**

```
Java Virtual Thread 성능 비교 테스트
Java 버전: 21.0.2
OS: Mac OS X 15.5
Available Processors: 10
Max Memory: 4096MB

=== 10000개 작업 (각 10ms 대기) 성능 테스트 ===
플랫폼 스레드 테스트 시작...
Virtual Thread 테스트 시작...

=== 결과 ===
Platform Threads: 604ms
Virtual Threads: 102ms
Virtual Thread가 5.92배 빠름
현재 메모리 사용량: 16MB
```

**50,000개 작업 실행 결과:**

```
Java Virtual Thread 성능 비교 테스트
Java 버전: 21.0.2
OS: Mac OS X 15.5
Available Processors: 10
Max Memory: 4096MB

=== 50000개 작업 (각 10ms 대기) 성능 테스트 ===
플랫폼 스레드 테스트 시작...
Virtual Thread 테스트 시작...

=== 결과 ===
Platform Threads: 2959ms
Virtual Threads: 227ms
Virtual Thread가 13.04배 빠름
현재 메모리 사용량: 52MB
```

**메모리 사용량 비교:**

| 스레드 타입 | 10,000개 작업 | 50,000개 작업 | 성능 향상 |
|------------|--------------|---------------|----------|
| Platform Thread | 604ms | 2,959ms | - |
| Virtual Thread | 102ms | 227ms | - |
| **성능 비율** | **5.92배** | **13.04배** | **작업 수 증가 시 더 효율적** |

## 성능 차이 분석

### 1. 왜 Virtual Thread가 빠른가?
- **컨텍스트 스위칭 오버헤드 감소**: JVM 레벨에서 관리되어 OS 레벨 컨텍스트 스위칭 불필요
- **효율적인 스케줄링**: I/O 대기 시 즉시 다른 작업으로 전환
- **메모리 효율성**: 스택 크기가 작아 더 많은 동시 작업 가능

### 2. 실제 측정된 작업 규모별 성능 개선
```
10,000개 작업:   Virtual Thread 약 6배 빠름 (604ms vs 102ms)
50,000개 작업:   Virtual Thread 약 13배 빠름 (2,959ms vs 227ms)
```

**패턴 분석:** 작업 수가 증가할수록 Virtual Thread의 성능 이점이 더욱 뚜렷해집니다.

# Virtual Thread 도입 가이드라인

## 언제 Virtual Thread를 사용해야 할까?

### ✅ Virtual Thread가 적합한 경우
- **I/O 집약적 애플리케이션**: 데이터베이스 쿼리, 파일 읽기/쓰기, 네트워크 통신이 많은 경우
- **웹 서버/API 서버**: 많은 동시 요청을 처리해야 하는 경우
- **마이크로서비스**: 서비스 간 통신이 빈번한 경우
- **배치 처리**: 대량의 데이터를 병렬로 처리해야 하는 경우
- **실시간 데이터 처리**: 스트리밍 데이터를 처리하는 경우

### ❌ Virtual Thread가 부적합한 경우
- **CPU 집약적 작업**: 복잡한 계산, 암호화, 이미지 처리 등
- **메모리 집약적 작업**: 대용량 데이터를 메모리에 로드하는 작업
- **실시간 시스템**: 매우 낮은 지연시간이 요구되는 시스템
- **레거시 코드**: synchronized 블록이 많이 사용된 기존 코드

## 마이그레이션 전략

### 1단계: 평가 및 계획
```java
// 현재 애플리케이션의 스레드 사용 패턴 분석
public class ThreadUsageAnalysis {
    public static void analyzeCurrentUsage() {
        ThreadMXBean threadMX = ManagementFactory.getThreadMXBean();
        
        System.out.println("=== 현재 스레드 사용 분석 ===");
        System.out.println("활성 스레드 수: " + threadMX.getThreadCount());
        System.out.println("최대 스레드 수: " + threadMX.getPeakThreadCount());
        
        // 스레드 덤프 분석을 통한 블로킹 패턴 확인
        ThreadInfo[] threadInfos = threadMX.dumpAllThreads(false, false);
        
        int blockedThreads = 0;
        int waitingThreads = 0;
        
        for (ThreadInfo info : threadInfos) {
            if (info.getThreadState() == Thread.State.BLOCKED) {
                blockedThreads++;
            } else if (info.getThreadState() == Thread.State.WAITING) {
                waitingThreads++;
            }
        }
        
        System.out.println("블로킹된 스레드: " + blockedThreads);
        System.out.println("대기 중인 스레드: " + waitingThreads);
        
        // I/O 집약적인지 CPU 집약적인지 판단
        double ioRatio = (double)(blockedThreads + waitingThreads) / threadInfos.length;
        System.out.println("I/O 비율: " + String.format("%.2f%%", ioRatio * 100));
        
        if (ioRatio > 0.3) {
            System.out.println("✅ Virtual Thread 도입 권장");
        } else {
            System.out.println("❌ Virtual Thread 도입 신중 검토 필요");
        }
    }
}
```

### 2단계: 점진적 도입
```java
// 기능별 점진적 도입
@Configuration
public class HybridThreadConfig {
    
    // I/O 집약적 작업용 Virtual Thread
    @Bean("ioExecutor")
    public ExecutorService ioExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }
    
    // CPU 집약적 작업용 Platform Thread
    @Bean("cpuExecutor")
    public ExecutorService cpuExecutor() {
        return Executors.newFixedThreadPool(
            Runtime.getRuntime().availableProcessors());
    }
    
    // 작업 타입에 따른 선택적 사용
    @Service
    public class TaskService {
        
        @Autowired
        @Qualifier("ioExecutor")
        private ExecutorService ioExecutor;
        
        @Autowired
        @Qualifier("cpuExecutor")
        private ExecutorService cpuExecutor;
        
        public CompletableFuture<String> processIOTask(String data) {
            return CompletableFuture.supplyAsync(() -> {
                // I/O 작업 (데이터베이스, API 호출 등)
                return performIOOperation(data);
            }, ioExecutor);
        }
        
        public CompletableFuture<String> processCPUTask(String data) {
            return CompletableFuture.supplyAsync(() -> {
                // CPU 집약적 작업 (계산, 암호화 등)
                return performCPUOperation(data);
            }, cpuExecutor);
        }
    }
}
```

### 3단계: 모니터링 및 최적화
```java
// 성능 모니터링 및 메트릭 수집
@Component
public class VirtualThreadMetrics {
    
    private final AtomicLong virtualThreadCount = new AtomicLong(0);
    private final AtomicLong completedTasks = new AtomicLong(0);
    private final AtomicLong errorCount = new AtomicLong(0);
    
    @EventListener
    public void onVirtualThreadCreated(VirtualThreadCreatedEvent event) {
        virtualThreadCount.incrementAndGet();
    }
    
    @EventListener
    public void onTaskCompleted(TaskCompletedEvent event) {
        completedTasks.incrementAndGet();
    }
    
    @EventListener
    public void onTaskError(TaskErrorEvent event) {
        errorCount.incrementAndGet();
    }
    
    @Scheduled(fixedRate = 60000) // 1분마다 메트릭 출력
    public void printMetrics() {
        System.out.println("=== Virtual Thread 메트릭 ===");
        System.out.println("생성된 Virtual Thread: " + virtualThreadCount.get());
        System.out.println("완료된 작업: " + completedTasks.get());
        System.out.println("에러 발생: " + errorCount.get());
        
        if (completedTasks.get() > 0) {
            double errorRate = (double) errorCount.get() / completedTasks.get() * 100;
            System.out.println("에러율: " + String.format("%.2f%%", errorRate));
        }
    }
}
```

# 미래 전망과 발전 방향

## Java의 Virtual Thread 로드맵

### 현재 상태 (Java 21)
- **안정화**: Preview에서 정식 기능으로 승격
- **성능 최적화**: JVM 레벨에서의 지속적인 성능 개선
- **도구 지원**: IDE, 프로파일러 등의 Virtual Thread 지원 강화

### 향후 계획
- **ScopedValue**: ThreadLocal의 대안으로 더 효율적인 스레드 로컬 저장소
- **Structured Concurrency**: 구조화된 동시성으로 더 안전한 병렬 프로그래밍
- **Foreign Function & Memory API**: 네이티브 코드와의 더 나은 통합

## 다른 언어와의 비교

| 언어 | 경량 스레드 | 특징 |
|------|------------|------|
| **Java** | Virtual Thread | JVM 관리, 기존 코드 호환성 우수 |
| **Go** | Goroutine | 언어 차원 지원, 매우 가벼움 |
| **Kotlin** | Coroutine | 구조화된 동시성, 취소 지원 |
| **Erlang/Elixir** | Actor Model | 격리된 프로세스, 장애 복구 |
| **Rust** | Async/Await | 제로 코스트 추상화, 메모리 안전성 |

# 결론

Virtual Thread는 Java 생태계에 혁신적인 변화를 가져온 기술입니다. **Project Loom**의 결실로 탄생한 이 기술은 다음과 같은 핵심 가치를 제공합니다:

## 🚀 주요 장점
1. **단순성**: 기존 Thread API와 완벽 호환되어 학습 비용 최소화
2. **확장성**: 수백만 개의 동시 작업 처리 가능
3. **성능**: I/O 집약적 작업에서 5-15배 성능 향상
4. **메모리 효율성**: 기존 대비 20배 이상 메모리 절약
5. **생산성**: 복잡한 비동기 코드 없이도 높은 동시성 달성

## 🎯 적용 분야
- **웹 애플리케이션**: 높은 동시 사용자 처리
- **마이크로서비스**: 서비스 간 통신 최적화
- **데이터 처리**: 대용량 배치 작업 가속화
- **IoT/실시간 시스템**: 대량 센서 데이터 처리

## 📈 도입 전략
1. **점진적 마이그레이션**: 기존 시스템의 I/O 집약적 부분부터 시작
2. **성능 측정**: 실제 워크로드에서의 성능 검증
3. **모니터링 강화**: Virtual Thread 특화 메트릭 수집
4. **팀 교육**: 새로운 동시성 모델에 대한 이해 증진

## 🔮 미래 전망
Virtual Thread는 Java의 동시성 프로그래밍을 근본적으로 변화시킬 것입니다. 앞으로는:
- **더 간단한 코드**: 복잡한 비동기 패턴의 필요성 감소
- **더 높은 성능**: 지속적인 JVM 최적화로 성능 향상
- **더 나은 도구**: IDE와 프로파일링 도구의 지원 강화
- **생태계 발전**: 프레임워크와 라이브러리의 Virtual Thread 최적화

Virtual Thread를 통해 Java 개발자들은 **"간단하면서도 고성능인"** 동시성 프로그래밍의 새로운 시대를 맞이하게 되었습니다. 이제 복잡한 비동기 코드에 얽매이지 않고도 확장 가능하고 효율적인 애플리케이션을 개발할 수 있습니다.

**Virtual Thread로 더 간단하고 효율적인 Java 애플리케이션을 개발해보세요!** 🎉

