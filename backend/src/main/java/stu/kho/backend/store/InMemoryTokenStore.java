package stu.kho.backend.store;

import org.springframework.stereotype.Component;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class InMemoryTokenStore {
    // Map: Token -> Data (Email + Hạn dùng)
    private final Map<String, TokenData> tokenMap = new ConcurrentHashMap<>();

    public static class TokenData {
        public String email;
        public LocalDateTime expiryDate;
        public TokenData(String email, LocalDateTime expiryDate) {
            this.email = email;
            this.expiryDate = expiryDate;
        }
    }

    public void saveToken(String token, String email) {
        // Token sống 5 phút
        tokenMap.put(token, new TokenData(email, LocalDateTime.now().plusMinutes(5)));
    }

    public String validateToken(String token) {
        if (!tokenMap.containsKey(token)) return "invalid";
        TokenData data = tokenMap.get(token);
        if (data.expiryDate.isBefore(LocalDateTime.now())) {
            tokenMap.remove(token);
            return "expired";
        }
        return data.email;
    }

    public void removeToken(String token) {
        tokenMap.remove(token);
    }
}