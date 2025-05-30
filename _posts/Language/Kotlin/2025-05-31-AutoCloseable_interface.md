---
layout: post
title: "AutoCloseable 인터페이스"
date: 2025-05-31
categories: ["Language/Kotlin"]
excerpt: "코틀린 2.0부터 안정화된 AutoCloseable 인터페이스와 use 확장 함수를 사용하여 리소스를 안전하게 관리하는 방법을 알아봅니다."
---
# 코틀린 `AutoCloseable` 인터페이스 마스터하기: 안전한 리소스 관리를 위한 핵심

코틀린 2.0.0 버전이 릴리스되면서, 표준 라이브러리의 여러 부분이 안정화되었으며 그중 하나가 바로 `AutoCloseable` 인터페이스입니다. 이 인터페이스는 파일, 네트워크 연결, 데이터베이스 커넥션 등 사용 후 반드시 닫아야 하는 리소스를 보다 안전하고 편리하게 관리할 수 있도록 돕습니다. 이번 포스트에서는 코틀린의 `AutoCloseable` 인터페이스가 무엇이며, 어떻게 활용할 수 있는지 자세히 알아보겠습니다.

## 1. `AutoCloseable` 인터페이스란?

`AutoCloseable` 인터페이스는 이름에서 알 수 있듯이 "자동으로 닫힐 수 있는" 객체를 위한 규약입니다. 이 인터페이스를 구현하는 클래스의 객체는 `close()` 메서드를 가지며, 이 메서드는 해당 객체가 사용한 리소스를 해제하는 역할을 합니다.

**주요 특징:**

*   **안정화 (Stable since Kotlin 2.0):** 코틀린 2.0부터 정식으로 안정화되어 모든 코틀린 대상 플랫폼(JVM, Native, JS, Wasm)에서 일관되게 사용할 수 있습니다. 이는 특히 멀티플랫폼 프로젝트에서 리소스 관리를 단일화하는 데 큰 이점을 제공합니다.
*   **리소스 누수 방지:** 사용한 리소스를 명시적으로 닫지 않으면 시스템 성능 저하나 예기치 않은 오류가 발생할 수 있습니다. `AutoCloseable`은 이러한 리소스 누수를 방지하는 데 핵심적인 역할을 합니다.
*   **Java 호환성:** Java 7에 도입된 `java.lang.AutoCloseable`과 유사한 개념으로, Java와의 상호운용성을 고려하여 설계되었습니다.

## 2. `use()` 확장 함수: 간결하고 안전한 리소스 관리

코틀린은 `AutoCloseable` 인터페이스를 구현하는 객체를 위해 매우 유용한 `use()` 확장 함수를 제공합니다. 이 함수는 Java의 `try-with-resources` 구문과 유사한 기능을 수행하며, 코드를 훨씬 간결하게 만들어줍니다.

```kotlin
import java.io.FileReader

fun readFile(path: String) {
    FileReader(path).use { reader ->
        // reader 객체를 사용하는 코드
        val text = reader.readText()
        println(text)
    } // 이 블록을 벗어나면 reader.close()가 자동으로 호출됩니다.
}
```

**`use()` 함수의 장점:**

*   **자동 리소스 해제:** `use` 블록 내의 코드가 정상적으로 실행되거나 예외가 발생하더라도, 블록이 끝나는 시점에 해당 리소스의 `close()` 메서드가 **항상 자동으로 호출**됩니다.
*   **간결한 구문:** `try-finally` 블록을 직접 작성할 필요 없이 리소스를 안전하게 관리할 수 있습니다.
*   **예외 처리:** `use` 블록 내에서 발생한 예외와 `close()` 메서드에서 발생한 예외 모두 적절하게 처리됩니다. 만약 `use` 블록과 `close()` 메서드 양쪽에서 예외가 발생하면, `close()`에서 발생한 예외는 `use` 블록에서 발생한 예외에 "억제된(suppressed)" 예외로 추가됩니다.

`use` 함수는 `Closeable` 인터페이스 (Java의 `java.io.Closeable`에 해당)에 대해서도 제공되며, `AutoCloseable`과 `Closeable`을 모두 구현하는 객체의 경우 컴파일러가 더 구체적인 타입의 `use` 함수를 선택합니다.

## 3. `AutoCloseable` 직접 구현 및 생성자 함수 활용

**사용자 정의 클래스에서 `AutoCloseable` 구현:**

직접 만드는 클래스가 외부 리소스를 사용하고 해제가 필요한 경우, `AutoCloseable` 인터페이스를 구현하고 `close()` 메서드에 리소스 해제 로직을 작성할 수 있습니다.

```kotlin
class MyResource(private val name: String) : AutoCloseable {
    init {
        println("리소스 '$name' 초기화됨")
    }

    fun doSomething() {
        println("리소스 '$name' 사용 중...")
    }

    override fun close() {
        println("리소스 '$name' 해제됨")
        // 실제 리소스 해제 로직 (예: 파일 닫기, 연결 종료 등)
    }
}

fun main() {
    MyResource("데이터베이스 연결").use { resource ->
        resource.doSomething()
    }
}
// 출력:
// 리소스 '데이터베이스 연결' 초기화됨
// 리소스 '데이터베이스 연결' 사용 중...
// 리소스 '데이터베이스 연결' 해제됨
```

**`AutoCloseable` 생성자 함수 사용:**

간단한 정리 작업이 필요한 경우, `AutoCloseable` 인터페이스를 직접 구현하는 클래스를 만들지 않고도 `AutoCloseable` 팩토리 함수를 사용하여 인스턴스를 생성할 수 있습니다. 이 함수는 `close()`가 호출될 때 실행될 람다를 인자로 받습니다.

```kotlin
fun main() {
    val customResource = AutoCloseable {
        println("임시 리소스 정리 작업 실행됨!")
    }

    customResource.use {
        println("임시 리소스 사용 중...")
    }
}
// 출력:
// 임시 리소스 사용 중...
// 임시 리소스 정리 작업 실행됨!
```

이 생성자 함수를 사용할 때 주의할 점은 `closeAction`으로 전달된 람다가 `close()` 메서드가 호출될 때마다 실행된다는 것입니다. 따라서 이 람다는 멱등성(idempotent, 여러 번 실행해도 결과가 동일함)을 가지도록 작성하거나, 여러 번 호출되지 않도록 주의해야 합니다.

## 4. Java의 `AutoCloseable` 및 `Closeable`과의 관계

*   **`java.lang.AutoCloseable`:** Java 7에서 도입되었으며, `try-with-resources` 구문을 통해 리소스를 자동으로 관리합니다. `close()` 메서드가 `Exception`을 던질 수 있도록 선언되어 있습니다.
*   **`java.io.Closeable`:** `AutoCloseable`의 하위 인터페이스로, `close()` 메서드가 `IOException`을 던지도록 선언되어 있으며, 멱등성을 가져야 합니다 (여러 번 호출해도 부작용 없음). 주로 I/O 관련 리소스에 사용됩니다.

코틀린의 `AutoCloseable`은 이러한 Java 인터페이스들과의 호환성을 염두에 두고 설계되었습니다. 코틀린의 `use` 함수는 JVM 플랫폼에서 이러한 인터페이스들을 구현한 Java 클래스 객체에도 원활하게 사용할 수 있습니다.

## 5. 결론

코틀린 2.0부터 안정화된 `AutoCloseable` 인터페이스와 `use` 확장 함수는 리소스 관리를 훨씬 더 안전하고 간결하게 만들어줍니다. 특히 멀티플랫폼 환경에서 일관된 리소스 관리 방법을 제공한다는 점에서 매우 유용합니다. 파일, 네트워크, 데이터베이스 등 외부 리소스를 다룰 때는 항상 `AutoCloseable`과 `use`를 활용하여 리소스 누수를 방지하고 코드의 안정성을 높이는 습관을 들이는 것이 좋습니다.


