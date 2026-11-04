import TienSaMap from "../../features/yard-design/TienSaMap";
import operationalPlan from "../../features/yard-design/operationalPlan.json";
import "../../features/yard-design/YardDesignPreview.css";
export default function SmartYardMap({
  navigation,
  label = "Sơ đồ đường nội bộ bãi",
}) {
  return (
    <div className="yard-design-preview" aria-label={label}>
      {navigation?.status === "available" &&
        navigation.map?.terminalPlan?.version !== operationalPlan.version && (
          <p role="status">
            Lệnh này dùng phiên bản bản đồ khác. Chưa thể hiển thị đường đi trên
            mặt bằng mới.
          </p>
        )}
      <TienSaMap navigation={navigation} operational />
    </div>
  );
}
